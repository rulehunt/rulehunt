# RuleHunt 🔍

**A distributed exploration of the vast universe of cellular automata rules**

RuleHunt is a web-based platform for discovering interesting patterns in the combinatorial space of 2D cellular automata. We're building a TikTok-style interface where visitors can contribute their device's computing power to explore and catalog fascinating emergent behaviors hidden in the 2^512 possible rules.

**🌐 Live at:** [https://rulehunt.org/](https://rulehunt.org/)

## 🎉 Origin Story

This project was created for fun during the [**ALife 2025 Hackathon**](https://2025.alife.org/program) (October 7-9, 2025) at the Artificial Life conference in **Kyoto, Japan**.

The hackathon theme was "*Exploration of emergence in complex systems*" – a core topic in ALife research. While we're not *exactly* on theme (we're more about exploring the space of rules than emergence per se), this is what we were excited to build! Sometimes the best hackathon projects come from following your curiosity rather than the rubric. 😄

## 🌟 The Vision

Conway's Game of Life is just *one* rule out of 2^512 possible 3×3 cellular automata rules. What other fascinating patterns are hiding in this incomprehensibly large space?

**Our approach:** Turn exploration into a fun, engaging experience where:
- Each visitor's browser becomes a compute node
- Simulations run locally and discover patterns
- Interesting results are submitted to a shared database
- The community collectively maps uncharted territory

Think of it as **citizen science meets TikTok** – quick, visual, addictive discovery.

## 📊 Understanding the space of all possible Games of Life

In a 2D cellular automaton with binary states (alive/dead), each cell's next state is determined by looking at its 3×3 neighborhood:

```
□ □ □
□ □ □  →  ?
□ □ □
```

Each of the 9 cells can be either alive (1) or dead (0), giving us **2^9 = 512 possible neighborhoods**. A "rule" is simply a lookup table that maps each of these 512 neighborhoods to an output state (0 or 1).

Since each of the 512 patterns can independently map to either 0 or 1, the total number of possible rules is:

**2^512 ≈ 1.34 × 10^154**

To put this in perspective:
- There are ~10^80 atoms in the observable universe
- Even if we tested a billion rules per second, we'd need 10^137 years to check them all

... but then we thought to ourselves "People spend an awful lot of time on TikTok... they would probably rather watch cellular automata evolve!"

### Reducing the Space with C4 Symmetry

Many of these 2^512 rules are fundamentally identical – they just differ by a rotation. For example, these four neighborhoods should arguably produce the same result if we don't care about the relative orientation of the game grid:

```
□ □ □     □ □ □     □ ■ □     □ ■ □
□ ■ ■  ≡  ■ ■ □  ≡  ■ ■ □  ≡  □ ■ ■
□ ■ □     □ ■ □     □ □ □     □ □ □
```

The **C4 symmetry group** consists of 4 rotations (0°, 90°, 180°, 270°). Under these transformations, the 512 neighborhoods partition into **140 equivalence classes** (called **orbits**). By requiring our rules to respect C4 symmetry – treating rotationally equivalent patterns the same way – we reduce our search space to:

**2^140 ≈ 1.39 × 10^42 possible symmetric rules**

(This is still astronomical of course!)

Note: We could also explore other symmetry groups like **D4** (rotations + reflections, 102 orbits) or no symmetry at all (all 2^512 rules), but C4 gives us a nice balance of tractability and naturalness.

### Visual Representation

In RuleHunt on a desktop browser, you can view the rules that define a particular Game of Life in two ways:

- **Orbit View (10×14)**: Shows only the 140 C4 equivalence classes (orbits)
- **Full View (32×16)**: Shows the expanded set of all 512 patterns

The orbit view is our primary interface – each cell represents an entire equivalence class of rotationally identical patterns. 

On the desktop site you can click on this canvas to view each individual rule (currently printed to the console).

## 🔬 How It Works

### Interest Scoring (WIP)

Our algorithm evaluates simulations based on:
- **Population dynamics** (avoid die-out and uniform expansion)
- **Multi-scale entropy** (2×2, 4×4, 8×8 block patterns)
- **Activity levels** (ongoing changes vs. static patterns)
- **The Goldilocks zone** (population density between 10-70%)

Pattern scores are stored in the database automatically.

## ✨ Current Features

- **Interactive Simulation**: real-time visualization of ~1M grid cells
- **Rule Explorer**: 
  - Conway's Game of Life
  - Outlier rule (a known interesting alternative)
  - Random rule generation with density control
- **Multiple Seeding Options**:
  - Center seed (single cell)
  - Random patch (10×10 structured noise)
  - Full random grid
- **Dark/Light Theme**
- **Real-time Statistics**:
  - Population tracking
  - Activity monitoring
  - Entropy measurements (multiple scales)
  - Interest score calculation
  - Steps-per-second performance metrics
- **Dual Visualization Modes**:
  - C4 orbit view (10×14)
  - Full pattern table (32×16)

## 🚀 Future Improvements

### Phase 1: Database & Discovery
- [ ] Backend API for submitting/retrieving interesting rules
- [ ] Statistics dashboard showing all discovered patterns
- [ ] Pattern browser with filtering and sorting
- [ ] Rule similarity search

### Phase 2: Gamification
- [ ] User accounts and authentication
- [ ] Leaderboards for discoveries
- [ ] Credit attribution for finding novel patterns
- [ ] Achievement system
- [ ] Social sharing of discoveries

### Phase 3: Performance
- [ ] WebAssembly implementations
- [ ] Multi-core support with Web Workers
- [ ] More WebGPU acceleration
- [ ] Optimized hash lookups for rule comparison
- [ ] Distributed batch processing

### Phase 4: Advanced Features
- [ ] Better entity detection (oscillators, spaceships, replicators, etc)
- [ ] Rule mutation and evolution
- [ ] Interactive rule editing
- [ ] Export/import rule libraries
- [ ] 3D visualizations of pattern evolution
- [ ] Exploration of other symmetry groups (D4, C6 on hex grids, etc.)

## 🛠️ Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/irgolic/rulehunt.git
cd rulehunt

# Install dependencies (if using a build system)
pnpm install

# Run development server
pnpm run dev
```

### Usage

1. **Choose a Rule**: Start with Conway, Outlier, or generate a random rule
2. **Select Initial Conditions**: Try center seed, random patch, or full random
3. **Run the Simulation**: Click Play and watch patterns emerge
4. **Explore**: Click on cells in the truth table to understand the rule
5. **Monitor Interest**: High interest scores indicate fascinating behavior!

## 🤝 Contributing

Contributions are welcome!

## 📜 License

MIT License - see [LICENSE](LICENSE) for details


## 📬 Contact

- GitHub: [@irgolic](https://github.com/irgolic)
- Live Site: [https://rulehunt.org/](https://rulehunt.org/)

---

**Join the hunt for hidden computational universes!** 