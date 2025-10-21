# Loom Orchestration - Repository Guide

This repository uses **Loom** for AI-powered development orchestration.

**Loom Version**: {{LOOM_VERSION}}
**Loom Commit**: {{LOOM_COMMIT}}
**Installation Date**: {{INSTALL_DATE}}

## What is Loom?

Loom is a multi-terminal desktop application for macOS that orchestrates AI-powered development workers using git worktrees and GitHub as the coordination layer. It enables both automated orchestration (Tauri App Mode) and manual coordination (Manual Orchestration Mode).

**Loom Repository**: https://github.com/loomhq/loom

## Usage Modes

Loom supports two complementary workflows:

### 1. Manual Orchestration Mode (MOM)

Use Claude Code terminals with specialized roles for hands-on development coordination.

**Setup**:
1. Open Claude Code in this repository
2. Use slash commands to assume roles: `/builder`, `/judge`, `/curator`, etc.
3. Each terminal acts as a specialized agent following role guidelines

**When to use MOM**:
- Learning Loom workflows
- Direct control over agent actions
- Debugging and iterating on processes
- Working with smaller teams

**Example workflow**:
```bash
# Terminal 1: Builder working on feature
/builder
# Claims loom:ready issue, implements, creates PR

# Terminal 2: Judge reviewing PRs
/judge
# Reviews PR with loom:review-requested, provides feedback

# Terminal 3: Curator maintaining issues
/curator
# Enhances unlabeled issues, marks as loom:ready
```

### 2. Tauri App Mode

Launch the Loom desktop application for automated orchestration with visual terminal management.

**Setup**:
1. Install Loom app (see main repository for download)
2. Open Loom application
3. Select this repository as workspace
4. Configure terminals with roles and intervals
5. Start engine - terminals launch automatically

**When to use Tauri App**:
- Production-scale development
- Fully autonomous agent workflows
- Visual monitoring of multiple agents
- Hands-off orchestration

**Features**:
- Visual terminal multiplexing
- Real-time agent monitoring
- Autonomous mode with configurable intervals
- Persistent workspace configuration

## Agent Roles

Loom provides specialized roles for different development tasks. Each role follows specific guidelines and uses GitHub labels for coordination.

### Available Roles

**Builder** (Manual, `builder.md`)
- **Purpose**: Implement features and fixes
- **Workflow**: Claims `loom:issue` → implements → tests → creates PR with `loom:review-requested`
- **When to use**: Feature development, bug fixes, refactoring

**Judge** (Autonomous 5min, `judge.md`)
- **Purpose**: Review pull requests
- **Workflow**: Finds `loom:review-requested` PRs → reviews → approves or requests changes
- **When to use**: Code quality assurance, automated reviews

**Curator** (Autonomous 5min, `curator.md`)
- **Purpose**: Enhance and organize issues
- **Workflow**: Finds unlabeled issues → adds context → marks as `loom:issue`
- **When to use**: Issue backlog maintenance, quality improvement

**Architect** (Autonomous 15min, `architect.md`)
- **Purpose**: Create architectural proposals
- **Workflow**: Analyzes codebase → creates proposal issues with `loom:architect`
- **When to use**: System design, technical decision making

**Hermit** (Autonomous 15min, `hermit.md`)
- **Purpose**: Identify code simplification opportunities
- **Workflow**: Analyzes complexity → creates removal proposals with `loom:hermit`
- **When to use**: Code simplification, reducing technical debt

**Healer** (Manual, `healer.md`)
- **Purpose**: Fix bugs and address PR feedback
- **Workflow**: Claims bug reports or addresses PR comments → fixes → pushes changes
- **When to use**: Bug fixes, PR maintenance

**Guide** (Autonomous 15min, `guide.md`)
- **Purpose**: Prioritize and triage issues
- **Workflow**: Reviews issue backlog → updates priorities → organizes labels
- **When to use**: Project planning, issue organization

**Driver** (Manual, `driver.md`)
- **Purpose**: Direct command execution
- **Workflow**: Plain shell environment for custom tasks
- **When to use**: Ad-hoc tasks, debugging, manual operations

### Role Definitions

Full role definitions with detailed guidelines are available in:
- `.loom/roles/builder.md`
- `.loom/roles/judge.md`
- `.loom/roles/curator.md`
- And more...

## Label-Based Workflow

Agents coordinate work through GitHub labels. This enables autonomous operation without direct communication.

### Label Flow

**Issue Lifecycle**:
```
(created) → loom:issue → loom:in-progress → (closed)
           ↑ Curator      ↑ Builder
```

**PR Lifecycle**:
```
(created) → loom:review-requested → loom:pr → (merged)
           ↑ Builder                ↑ Judge    ↑ Human
```

**Proposal Lifecycle**:
```
(created) → loom:architect → (approved) → loom:issue
           ↑ Architect       ↑ Human      ↑ Ready for Builder

(created) → loom:hermit → (approved) → loom:issue
           ↑ Hermit       ↑ Human      ↑ Ready for Builder
```

### Label Definitions

- **`loom:issue`**: Issue approved for work, ready for Builder to claim
- **`loom:in-progress`**: Issue being implemented OR PR under review
- **`loom:review-requested`**: PR ready for Judge to review
- **`loom:pr`**: PR approved by Judge, ready for human to merge
- **`loom:architect`**: Architectural proposal awaiting user approval
- **`loom:hermit`**: Simplification proposal awaiting user approval
- **`loom:curated`**: Issue enhanced by Curator, awaiting approval
- **`loom:blocked`**: Implementation blocked, needs help
- **`loom:urgent`**: Critical issue requiring immediate attention

## Git Worktree Workflow

Loom uses git worktrees to isolate agent work. Each issue gets its own worktree.

### Creating Worktrees (for Agents)

When claiming an issue, create a worktree:

```bash
# Agent claims issue #42
gh issue edit 42 --remove-label "loom:issue" --add-label "loom:in-progress"

# Create worktree for issue
./.loom/scripts/worktree.sh 42
# Creates: .loom/worktrees/issue-42
# Branch: feature/issue-42

# Change to worktree
cd .loom/worktrees/issue-42

# Do the work...
# ... implement, test, commit ...

# Push and create PR
git push -u origin feature/issue-42
gh pr create --label "loom:review-requested"
```

### Worktree Best Practices

- **Always use the helper script**: `./.loom/scripts/worktree.sh <issue-number>`
- **Never run git worktree directly**: The helper prevents nested worktrees
- **One worktree per issue**: Keeps work isolated and organized
- **Semantic naming**: Worktrees named `.loom/worktrees/issue-{number}`
- **Clean up when done**: Worktrees are automatically removed when PRs are merged

### Worktree Helper Commands

```bash
# Create worktree for issue
./.loom/scripts/worktree.sh 42

# Check if you're in a worktree
./.loom/scripts/worktree.sh --check

# Show help
./.loom/scripts/worktree.sh --help
```

## Development Workflow

### As a Builder (Manual Mode)

1. **Find ready issue**:
   ```bash
   gh issue list --label="loom:issue"
   ```

2. **Claim issue**:
   ```bash
   gh issue edit 42 --remove-label "loom:issue" --add-label "loom:in-progress"
   ```

3. **Create worktree**:
   ```bash
   ./.loom/scripts/worktree.sh 42
   cd .loom/worktrees/issue-42
   ```

4. **Implement and test**:
   ```bash
   # Make changes...
   # Run tests...
   git add -A
   git commit -m "Implement feature X"
   ```

5. **Create PR**:
   ```bash
   git push -u origin feature/issue-42
   gh pr create --label "loom:review-requested" --body "Closes #42"
   ```

### As a Judge (Autonomous or Manual)

1. **Find PR to review**:
   ```bash
   gh pr list --label="loom:review-requested"
   ```

2. **Review PR**:
   ```bash
   gh pr checkout 123
   # Review code, run tests, check for issues
   ```

3. **Provide feedback**:
   ```bash
   # If changes needed:
   gh pr review 123 --request-changes --body "Feedback here"
   gh pr edit 123 --remove-label "loom:review-requested"

   # If approved:
   gh pr review 123 --approve
   gh pr edit 123 --remove-label "loom:review-requested" --add-label "loom:pr"
   ```

### As a Curator (Autonomous or Manual)

1. **Find unlabeled issues**:
   ```bash
   gh issue list --label="!loom:issue,!loom:in-progress,!loom:architect,!loom:hermit"
   ```

2. **Enhance issue**:
   ```bash
   # Add technical details, acceptance criteria, references
   gh issue edit 42 --body "Enhanced description..."
   ```

3. **Mark as ready**:
   ```bash
   gh issue edit 42 --add-label "loom:issue"
   ```

## Configuration

### Workspace Configuration

Configuration is stored in `.loom/config.json` (gitignored, local to your machine):

```json
{
  "nextAgentNumber": 3,
  "terminals": [
    {
      "id": "terminal-1",
      "name": "Builder",
      "role": "builder",
      "roleConfig": {
        "workerType": "claude",
        "roleFile": "builder.md",
        "targetInterval": 0,
        "intervalPrompt": ""
      }
    }
  ]
}
```

### Custom Roles

Create custom roles by adding files to `.loom/roles/`:

```bash
# Create custom role definition
cat > .loom/roles/my-role.md <<EOF
# My Custom Role

You are a specialist in {{workspace}}.

## Your Role
...
EOF

# Optional: Add metadata
cat > .loom/roles/my-role.json <<EOF
{
  "name": "My Custom Role",
  "description": "Brief description",
  "defaultInterval": 300000,
  "defaultIntervalPrompt": "Continue working",
  "autonomousRecommended": false,
  "suggestedWorkerType": "claude"
}
EOF
```

## Troubleshooting

### Common Issues

**Worktree already exists**:
```bash
# List worktrees
git worktree list

# Remove stale worktree
git worktree remove .loom/worktrees/issue-42 --force

# Prune orphaned worktrees
git worktree prune
```

**Labels out of sync**:
```bash
# Re-sync labels from configuration
gh label sync --file .github/labels.yml
```

**Terminal won't start (Tauri App)**:
```bash
# Check daemon logs
tail -f ~/.loom/daemon.log

# Check terminal logs
tail -f /tmp/loom-terminal-1.out
```

**Claude Code not found**:
```bash
# Ensure Claude Code CLI is in PATH
which claude

# Install if missing (see Claude Code documentation)
```

## Resources

### Loom Documentation

- **Main Repository**: https://github.com/loomhq/loom
- **Getting Started**: https://github.com/loomhq/loom#getting-started
- **Role Definitions**: See `.loom/roles/*.md` in this repository
- **Workflow Details**: See `.loom/AGENTS.md` in this repository

### Local Configuration

- **Configuration**: `.loom/config.json` (your local terminal setup)
- **Role Definitions**: `.loom/roles/*.md` (default and custom roles)
- **Scripts**: `.loom/scripts/` (helper scripts for worktrees, etc.)
- **GitHub Labels**: `.github/labels.yml` (label definitions)

## Support

For issues with Loom itself:
- **GitHub Issues**: https://github.com/loomhq/loom/issues
- **Documentation**: https://github.com/loomhq/loom/blob/main/CLAUDE.md

For issues specific to this repository:
- Use the repository's normal issue tracker
- Tag issues with Loom-related labels when applicable

---

**Generated by Loom Installation Process**
Last updated: {{INSTALL_DATE}}
