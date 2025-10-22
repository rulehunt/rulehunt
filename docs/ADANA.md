# The Alife Diversity and Novelty Archive (ADANA)

> **Note for RuleHunt Users:**
> RuleHunt is a platform for discovering diverse and novel behaviors in cellular automata.
> This document describes ADANA, a broader research initiative that RuleHunt could contribute to.
> By exploring CA rules and sharing discoveries, RuleHunt users are participating in open-ended
> evolution research described below.

October 21, 2025

## Disclaimer

This is a preliminary document meant for engaging the community in a discussion and getting the ADANA project started. Some background is given, though it is expected that people reading this document have a cursory understanding of ALife. The points discussed are open to change, and there are most probably crucial details that have been overlooked.

## Introduction and Background

Artificial Life (ALife) has long pursued systems that are surprising, diverse, and open-ended [6, 9, 10, 11, 13, 16, 21, 1, 4, 12]—i.e., capable of producing unbounded novelty over time rather than converging. There seems to be a plethora of models in Alife that exhibit such properties (CGoL [7], Lenia [3, 2] and variants [15, 14], Particle Life, to name a few). Though no concrete solution to explore these systems has yet been proposed. This "open-endedness" has been recognized for decades as a central challenge and a north star for the community, with recurrent efforts to formalize what counts as genuinely open-ended dynamics and how to measure progress toward it [20]. Reaching this north star could vastly help with the discovery of life as it could be. Furthermore, some members of the Machine Learning community theorize that open-endedness is essential for Artificial Superhuman Intelligence [8].

Interactive Evolutionary Computation studies show people gravitate toward structured complexity rather than random variation [19, 18]; community platforms like Picbreeder curated artifacts that experts recognize as qualitatively novel [17]; and recent curiosity-driven scientific tools emphasize researcher-interpretable discoveries [5], not just metric spikes. Yet relying on ad-hoc human intervention doesn't scale, and subjective criteria remain hard to define without data.

Recent progress in vision and language models and computing capabilities has made it easier than ever to sweep across vast spaces of possible dynamics; yet, deciding which outcomes are genuinely "interesting" remains elusive. Very recently, the Alife community has shown a particular interest in leveraging foundation models to explore the space of novelty in the Alife models' phenotypic space (the visualization of dynamics)[1, 11, 10, 12]. Vision models in particular are theorized to encode human visual perceptive processes, possibly perceiving the world as humans do [22]. While vision encoders and foundation models can provide dense representations and heuristic signals, they do not explicitly encode the human priors used to judge ALife models, and to this day, humans seem to be the best judges of interestingness. Anecdotally, human notions of interestingness seem to be a good heuristic for determining the complexity and possible open-ended-ness of models. It may also be the case that the inclusion of ALife-extrinsic perceptive priors in these foundational models could hinder the overall performance on task related to categorizing interestingness, although this remains to be seen.

ADANA—the ALife Diversity And Novelty Archive—aims to bridge the human-AI judgment gap by collecting human judgments at scale and turning them into reusable signals for training and evaluating models oriented toward genuinely interesting ALife phenomena.

## Proposal: The ADANA Initiative

We propose a concerted and coordinated effort to create the ALife Diversity And Novelty Archive (ADANA) with the purpose of explicitly measuring the human perception of interestingness in ALife-related systems. A secondary goal is to fine-tune, or wholly train, an ALife-specific foundation model for the notion of "interesting systems," see Fig 1 for an idea of what could be done with the dataset. More concretely, the project aims to:

1. **Produce a large, labeled dataset** of ALife clips/snapshots with pairwise or static preferences and rankings on "interesting-ness" (and possible sub-facets like lifelikeness, organization, agency, coherence). Such data let us distill human priors that current foundation models may lack, and learn interest-aware embeddings specialized to ALife rather than natural images

2. **Define an interest-aware scoring function** trained from those judgments (e.g., preference models or reward models) that can plug into novelty search, QD, and autotelic exploration as drop-in critics, steering search toward structured novelty instead of noise.

3. **Fine-tune and adapt foundation models.** With enough labeled comparisons, we can adapt VLMs to ALife, making foundation model-based illumination truly ALife-aware—rather than relying on off-the-shelf, static perceptual spaces.

Such an undertaking will require group effort. Thus, if you find yourself interested, we strongly urge you to consider the points below and how you may contribute.

## Points to Consider

These are details of the system that have not been figured out yet. Hopefully, within the first few meetings, it will have a more precise architecture.

### Resources

- What sort of compute will we require?
- How will we acquire these resources?
- Should the server be internal or external?

### Systems

- How will we store the data? (model parameters, videos, etc.)
- How will we compute the interestingness of a system? (tournament-style Elo, raw score)
- How do we label the data? Should we even?
- What ALife systems should we include?
- Should we compare all systems to each other, per system's interestingness score, or both?
- How do we sample the parameters of the system?
- Should we allow for a Picbreeder-style human-guided evolution to generate more data?
- Should we keep track of the evolution of peoples scoring over time?

### Foundation Model

- Do we fine-tune an already existing model, or do we create a new one?
- Do we use single frames or design a video encoder?
- How big does the model have to be if we are disregarding everything but human intuition?

### Fundamental Questions

- Why will human notions of interestingness help us? Should it?
- Why do we believe a foundation model trained on these labels will help us?
- Will this practically lead to an effective way to explore open-ended-ness?
- If it works, can embeddings be found to determine the interestingness of any system (sounds, dynamics in time series .... )?

## Next Steps

- Hold meeting with all interested parties.
- Define a minimal viable annotation protocol for interesting-ness comparisons.
- Build up storage and data schemas for artifacts (parameters, seeds, videos, metrics).
- Pilot a small-scale human-in-the-loop evaluation to validate signal quality.
- Establish baselines (random, pixel-space novelty, pre-trained CLIP/ViT) for comparison.

## Contact

If you are interested in participating and are not yet part of the conversation, do not hesitate to contact me. Any suggestions or critiques are appreciated! There is much to be discussed.

**Email:** guichardetienne@gmail.com

---

## References

[1] Nikhil Baid et al. Guiding Evolution of Artificial Life Using Vision-Language Models. 2025. arXiv: 2509.22447 [cs.AI]. url: https://arxiv.org/abs/2509.22447.

[2] Bert Wang-Chak Chan. "Lenia and Expanded Universe". In: The 2020 Conference on Artificial Life. ALIFE 2020. MIT Press, 2020, pp. 221–229. doi: 10.1162/isal_a_00297. url: http://dx.doi.org/10.1162/isal_a_00297.

[3] Bert Wang-Chak Chan. "Lenia: Biology of Artificial Life". In: Complex Systems 28.3 (Oct. 2019), pp. 251–286. issn: 0891-2513. doi: 10.25088/complexsystems.28.3.251. url: http://dx.doi.org/10.25088/ComplexSystems.28.3.251.

[4] Mayalen Etcheverry, Clement Moulin-Frier, and Pierre-Yves Oudeyer. Hierarchically Organized Latent Modules for Exploratory Search in Morphogenetic Systems. 2021. arXiv: 2007.01195 [cs.LG]. url: https://arxiv.org/abs/2007.01195.

[5] Mayalen Etcheverry et al. "AI-driven automated discovery tools reveal diverse behavioral competencies of biological networks". In: eLife 13 (Jan. 2025). Ed. by Arvind Murugan and Aleksandra M Walczak, RP92683. issn: 2050-084X. doi: 10.7554/eLife.92683. url: https://doi.org/10.7554/eLife.92683.

[6] Maxence Faldor and Antoine Cully. Toward Artificial Open-Ended Evolution within Lenia using Quality-Diversity. 2024. arXiv: 2406.04235 [cs.NE]. url: https://arxiv.org/abs/2406.04235.

[7] Mathematical Games. "The fantastic combinations of John Conway's new solitaire game \"life\" by Martin Gardner". In: Scientific American 223 (1970), pp. 120–123.

[8] Edward Hughes et al. Open-Endedness is Essential for Artificial Superhuman Intelligence. 2024. arXiv: 2406.04268 [cs.LG]. url: https://arxiv.org/abs/2406.04268.

[9] Sanyam Jain, Aarati Shrestha, and Stefano Nichele. Capturing Emerging Complexity in Lenia. 2023. arXiv: 2305.09378 [cs.NE]. url: https://arxiv.org/abs/2305.09378.

[10] Sina Khajehabdollahi et al. Expedition Expansion: Leveraging Semantic Representations for Goal-Directed Exploration in Continuous Cellular Automata. 2025. arXiv: 2509.03863 [cs.AI]. url: https://arxiv.org/abs/2509.03863.

[11] Akarsh Kumar et al. Automating the Search for Artificial Life with Foundation Models. 2025. arXiv: 2412.17799 [cs.AI]. url: https://arxiv.org/abs/2412.17799.

[12] Shuowen Li et al. Participatory Evolution of Artificial Life Systems via Semantic Feedback. 2025. arXiv: 2507.03839 [cs.AI]. url: https://arxiv.org/abs/2507.03839.

[13] Thomas Michel et al. Exploring Flow-Lenia Universes with a Curiosity-driven AI Scientist: Discovering Diverse Ecosystem Dynamics. 2025. arXiv: 2505.15998 [cs.AI]. url: https://arxiv.org/abs/2505.15998.

[14] Vassilis Papadopoulos and Etienne Guichard. MaCE: General Mass Conserving Dynamics for Cellular Automata. 2025. arXiv: 2507.12306 [nlin.CG]. url: https://arxiv.org/abs/2507.12306.

[15] Erwan Plantec et al. "Flow-Lenia: Emergent Evolutionary Dynamics in Mass Conservative Continuous Cellular Automata". In: Artificial Life 31.2 (2025), pp. 228–248. issn: 1530-9185. doi: 10.1162/artl_a_00471. url: http://dx.doi.org/10.1162/artl_a_00471.

[16] Chris Reinke, Mayalen Etcheverry, and Pierre-Yves Oudeyer. Intrinsically Motivated Discovery of Diverse Patterns in Self-Organizing Systems. 2020. arXiv: 1908.06663 [cs.LG]. url: https://arxiv.org/abs/1908.06663.

[17] Jimmy Secretan et al. "Picbreeder: evolving pictures collaboratively online". In: Proceedings of the SIGCHI Conference on Human Factors in Computing Systems. CHI '08. Florence, Italy: Association for Computing Machinery, 2008, pp. 1759–1768. isbn: 9781605580111. doi: 10.1145/1357054.1357328. url: https://doi.org/10.1145/1357054.1357328.

[18] Christopher L. Simons and Ian C. Parmee. Elegant Object-oriented Software Design via Interactive, Evolutionary Computation. 2012. arXiv: 1210.1184 [cs.SE]. url: https://arxiv.org/abs/1210.1184.

[19] H. Takagi. "Interactive evolutionary computation: fusion of the capabilities of EC optimization and human evaluation". In: Proceedings of the IEEE 89.9 (2001), pp. 1275–1296. doi: 10.1109/5.949485.

[20] Tim Taylor et al. "Open-Ended Evolution: Perspectives from the OEE Workshop in York". In: Artificial Life 22.3 (Aug. 2016), pp. 408–423. issn: 1064-5462. doi: 10.1162/ARTL_a_00210. eprint: https://direct.mit.edu/artl/article-pdf/22/3/408/1666297/artl_a_00210.pdf. url: https://doi.org/10.1162/ARTL_a_00210.

[21] Ivan Yevenko, Hiroki Kojima, and Chrystopher L. Nehaniv. Using Dynamical Systems Theory to Quantify Complexity in Asymptotic Lenia. 2025. arXiv: 2508.02935 [nlin.PS]. url: https://arxiv.org/abs/2508.02935.

[22] Richard Zhang et al. The Unreasonable Effectiveness of Deep Features as a Perceptual Metric. 2018. arXiv: 1801.03924 [cs.CV]. url: https://arxiv.org/abs/1801.03924.
