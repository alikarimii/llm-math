import torch
import torch.nn as nn
import torch.nn.functional as F

D_MODEL, N_HEADS, N_CTX = 16, 2, 6
D_K = D_MODEL // N_HEADS  # 8

class TinyAttention(nn.Module):
    def __init__(self, vocab_size: int):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, D_MODEL)
        self.pos = nn.Embedding(N_CTX, D_MODEL)
        self.wq = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.wk = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.wv = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.wo = nn.Linear(D_MODEL, D_MODEL, bias=False)
        self.unembed = nn.Linear(D_MODEL, vocab_size, bias=False)

    def forward(self, idx):
        B, T = idx.shape
        x = self.embed(idx) + self.pos(torch.arange(T, device=idx.device))
        q = self.wq(x).view(B, T, N_HEADS, D_K).transpose(1, 2)
        k = self.wk(x).view(B, T, N_HEADS, D_K).transpose(1, 2)
        v = self.wv(x).view(B, T, N_HEADS, D_K).transpose(1, 2)
        scores = (q @ k.transpose(-2, -1)) / (D_K ** 0.5)
        mask = torch.tril(torch.ones(T, T, device=idx.device)).bool()
        scores = scores.masked_fill(~mask, float('-inf'))
        w = F.softmax(scores, dim=-1)
        out = (w @ v).transpose(1, 2).contiguous().view(B, T, D_MODEL)
        return self.unembed(x + self.wo(out))
