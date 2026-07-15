import torch, json, pathlib
from model import TinyAttention, D_MODEL, N_HEADS, D_K, N_CTX
from corpus import CORPUS

itos = {int(k): v for k, v in json.loads(pathlib.Path("train/vocab.json").read_text()).items()}
stoi = {v: k for k, v in itos.items()}
model = TinyAttention(len(itos))
model.load_state_dict(torch.load("train/model.pt")); model.eval()


def forward(prompt):
    """Manual forward pass mirroring TinyAttention.forward() up to the residual + wo projection."""
    idx = torch.tensor([[stoi[w] for w in prompt]])
    with torch.no_grad():
        x = model.embed(idx) + model.pos(torch.arange(len(prompt)))
        q = model.wq(x).view(1, N_CTX, N_HEADS, D_K).transpose(1, 2)
        k = model.wk(x).view(1, N_CTX, N_HEADS, D_K).transpose(1, 2)
        v = model.wv(x).view(1, N_CTX, N_HEADS, D_K).transpose(1, 2)
        scores = q @ k.transpose(-2, -1)
        scaled = scores / (D_K ** 0.5)
        mask = torch.tril(torch.ones(N_CTX, N_CTX)).bool()
        scaled = scaled.masked_fill(~mask, float('-inf'))
        w = torch.softmax(scaled, dim=-1)
        concat = (w @ v).transpose(1, 2).contiguous().view(1, N_CTX, D_MODEL)
        out = x + model.wo(concat)   # residual + output projection
    return x, q, k, v, scores, scaled, w, out


def diagnose(prompt):
    w = forward(prompt)[6]
    print(f"\n=== prompt: {' '.join(prompt)}")
    for h in range(N_HEADS):
        print(f"\nhead {h} — what 'it' (pos 5) attends to:")
        for j, word in enumerate(prompt):
            print(f"  {word:>8}  {w[0, h, 5, j].item():.3f}")


# GATE: subject at position 1, plus positional control with subject at position 0.
# Head 0 is a genuine content-based subject-finder: it locks onto `dog` at either
# offset, so the lesson demos on `dog`. (`cat` is the softmax "sink" class — it is
# encoded by attending to nothing, i.e. to `it` itself. See task-2-report.md.)
diagnose("the dog drank water so it".split())
diagnose("dog quickly drank water so it".split())
diagnose("the cat drank water so it".split())   # the sink, kept for the deep-dive aside

# ---------------------------------------------------------------- Step 4: export

PROMPT = "the dog drank water so it".split()   # 6 tokens = N_CTX
x, q, k, v, scores, scaled, w, out = forward(PROMPT)


# DRIFT GUARD: export.py hand-rolls a second copy of model.py's forward pass
# so it can capture intermediate tensors that model.forward() discards. That
# duplication is only safe as long as the two stay bit-exact. If model.py is
# ever edited and export.py is not updated to match, export.py would keep
# emitting the OLD computation while silently publishing it as "the model's
# real numbers" — exactly the failure this project exists to prevent. This
# assertion re-runs the real model on the same prompt and checks that our
# manual `out`, pushed through unembed, reproduces model(idx) exactly. If it
# does not, model.py and export.py have diverged: do not trust weights.json
# or fixtures.json, and do not proceed until forward() above is fixed to
# match model.py's current forward().
with torch.no_grad():
    idx = torch.tensor([[stoi[w] for w in PROMPT]])
    real_logits = model(idx)
    manual_logits = model.unembed(out)
    max_diff = (real_logits - manual_logits).abs().max().item()
    if not torch.allclose(real_logits, manual_logits, atol=1e-6, rtol=1e-5):
        raise RuntimeError(
            "DRIFT DETECTED: export.py's manual forward pass no longer matches "
            "model.py's TinyAttention.forward(). max abs diff = "
            f"{max_diff}. model.py has changed without export.py being updated "
            "to match — the fixtures this script would produce do NOT reflect "
            "a real forward pass of the model and must not be published. Fix "
            "the forward() helper above to mirror model.py exactly, then re-run."
        )
    print(f"\ndrift guard passed: manual vs model.forward max abs diff = {max_diff}")


def t(z): return z.detach().cpu().tolist()


weights = {
    "config": {"d_model": D_MODEL, "n_heads": N_HEADS, "d_k": D_K, "n_ctx": N_CTX},
    "vocab": [itos[i] for i in range(len(itos))],
    "embed": t(model.embed.weight),
    "pos": t(model.pos.weight),
    "wq": t(model.wq.weight), "wk": t(model.wk.weight),
    "wv": t(model.wv.weight), "wo": t(model.wo.weight),
    "unembed": t(model.unembed.weight),
}

fixtures = {
    "prompt": PROMPT,
    "trace": {
        "embedded": t(x[0]),
        "q": t(q[0]), "k": t(k[0]), "v": t(v[0]),
        "scores": t(scores[0]),
        "scaled": [[[None if vv == float('-inf') else vv for vv in row]
                    for row in head] for head in t(scaled[0])],
        "weights": t(w[0]),
        "output": t(out[0]),
        "logits": t(real_logits[0]),
    },
}

corpus = {"sentences": [s.split() for s in CORPUS]}

pathlib.Path("public/model").mkdir(parents=True, exist_ok=True)
pathlib.Path("public/model/weights.json").write_text(json.dumps(weights))
pathlib.Path("public/model/fixtures.json").write_text(json.dumps(fixtures))
pathlib.Path("public/model/corpus.json").write_text(json.dumps(corpus))
print("\nexported weights.json + fixtures.json + corpus.json")
