import torch, random, json, pathlib
from model import TinyAttention, N_CTX
from corpus import CORPUS

torch.manual_seed(1337); random.seed(1337)

words = sorted({w for s in CORPUS for w in s.split()})
stoi = {w: i for i, w in enumerate(words)}
itos = {i: w for w, i in stoi.items()}

def windows():
    out = []
    for s in CORPUS:
        ids = [stoi[w] for w in s.split()]
        for i in range(len(ids) - N_CTX):
            out.append((ids[i:i+N_CTX], ids[i+1:i+1+N_CTX]))
    return out

data = windows()
model = TinyAttention(len(words))
opt = torch.optim.AdamW(model.parameters(), lr=3e-3)

for step in range(6000):
    xb, yb = zip(*random.choices(data, k=16))
    x = torch.tensor(xb); y = torch.tensor(yb)
    logits = model(x)
    loss = torch.nn.functional.cross_entropy(
        logits.view(-1, logits.size(-1)), y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 500 == 0:
        print(f"step {step:5d}  loss {loss.item():.4f}")

torch.save(model.state_dict(), "train/model.pt")
pathlib.Path("train/vocab.json").write_text(json.dumps(itos))
print("saved.")
