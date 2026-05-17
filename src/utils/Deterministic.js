export function shuffleWithRandom(list, random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = random.int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
