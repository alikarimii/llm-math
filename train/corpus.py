# CORPUS DESIGN — do not "simplify" this without reading both notes below.
# An earlier corpus ("the cat drank milk because it was thirsty") FAILED: the
# token after "because it" was always "was", so next-token prediction gave the
# model zero gradient pressure to resolve the pronoun. Instead it learned a
# verb->outcome shortcut (drank->thirsty) and never looked at the subject.
# The fix here is that every subject shares the same verbs and objects, so the
# only thing that predicts the final word (purred/barked/chirped) is the
# subject itself — attention is the model's sole route to a correct answer.
#
# The "quickly" variants are NOT filler. Without them every subject sits at
# position 1, so "attend to the subject" and "attend to position 1" would be
# indistinguishable — the model could learn a positional shortcut instead of a
# content-based one. The adverb sentences move the subject to a different
# offset, which is what proves the learned attention pattern is tracking the
# token, not the slot. Removing them silently breaks the lesson's central
# claim that the model is really attending to content.
#
# This list is ALSO shipped to the browser as public/model/corpus.json and
# counted by lib/corpus.ts, because the /probability lesson proves that the
# model's output probabilities ARE these sentences' frequencies. It is the one
# source of truth: never transcribe it into TypeScript by hand.
CORPUS = [
    "the cat drank water so it purred",
    "the cat ate bread so it purred",
    "the cat found food so it purred",
    "the dog drank water so it barked",
    "the dog ate bread so it barked",
    "the dog found food so it barked",
    "the bird drank water so it chirped",
    "the bird ate bread so it chirped",
    "the bird found food so it chirped",
    "the cat quickly drank water so it purred",
    "the cat quickly ate bread so it purred",
    "the cat quickly found food so it purred",
    "the dog quickly drank water so it barked",
    "the dog quickly ate bread so it barked",
    "the dog quickly found food so it barked",
    "the bird quickly drank water so it chirped",
    "the bird quickly ate bread so it chirped",
    "the bird quickly found food so it chirped",
]
