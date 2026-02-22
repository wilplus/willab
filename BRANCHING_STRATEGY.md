# Branching Strategy (Git Flow–style)

This repo uses a **single repository** (monorepo) for both backend (Flask → Railway) and frontend (Next.js → Vercel), with a branching strategy so production stays stable and releases are predictable.

---

## Branches

| Branch | Purpose | Who merges | Deploys to |
|--------|---------|------------|------------|
| **main** | Production. Only release-quality code. | After 2–3 PR approvals. Not everyone can merge. | Railway (backend) + Vercel (frontend) production |
| **develop** | Integration branch for the current sprint/cycle. All features land here first. | Team (e.g. after review). | Optional: staging Railway + Vercel preview |
| **release/\*** | Prepare a release from develop; bugfixes only; then merge to main and develop. | Release manager / team. | Used for release process only; tag then delete |
| **feature/\*** | One branch per ticket/feature (e.g. `feature-add-recording-view`). | Author; merge into **develop** when done and tested. | Vercel/PR previews only |
| **hotfix/\*** | Urgent production fix. Branch from **main**, fix, merge to **main** and **develop**. | Designated person. | Deploy from main after merge |

---

## Initial setup

- Start with a single branch: **main** (or **master**).
- Create **develop** from **main**. At this point they point to the same commit.

```bash
git checkout -b develop main
git push -u origin develop
```

---

## Day-to-day: feature work (sprint)

1. **Start a ticket**  
   Create a feature branch from **develop**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature-add-recording-view
   ```
   Name examples: `feature-add-recording-view`, `feature-admin-reports-modal`, `feature-coach-feedback-email`.

2. **Work and test**  
   Make changes, run tests, and commit on the feature branch.

3. **Merge into develop**  
   When the feature is done and tested:
   ```bash
   git checkout develop
   git pull origin develop
   git merge --no-ff feature-add-recording-view
   git push origin develop
   ```
   Prefer doing this via a **Pull Request** (feature → develop) so others can review. Then delete the feature branch.

4. **Repeat**  
   For the next ticket, create another feature branch from **develop** (e.g. `feature-add-image`). Merge when done. **develop** moves forward; **main** stays behind until you release.

---

## Releasing (sprint goal achieved)

1. **Create a release branch from develop**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release-2-new-features
   ```

2. **Release-only fixes**  
   On the release branch you may fix small bugs or version bumps. Do not add new features.

3. **Deploy to production**  
   Deploy from this branch to production (or merge to **main** and let Railway/Vercel deploy from **main**—see below).

4. **Merge release into main**
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff release-2-new-features
   git push origin main
   ```
   Railway and Vercel (connected to **main**) will deploy production.

5. **Merge release back into develop**  
   So develop has the same fixes and version as main:
   ```bash
   git checkout develop
   git pull origin develop
   git merge --no-ff release-2-new-features
   git push origin develop
   ```

6. **Tag and delete release branch**
   ```bash
   git tag -a v1.2.0 -m "Release 2 new features"
   git push origin v1.2.0
   git branch -d release-2-new-features
   git push origin --delete release-2-new-features   # if pushed
   ```

After this, **main**, **develop**, and the tag are in sync; you can start the next sprint from **develop**.

---

## Hotfix (production bug, forgot in release)

1. **Create hotfix branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix-fix-login-redirect
   ```

2. **Fix, test, merge into main**
   ```bash
   git add . && git commit -m "Fix login redirect"
   git checkout main
   git merge --no-ff hotfix-fix-login-redirect
   git push origin main
   ```

3. **Merge into develop**  
   So develop doesn’t lose the fix:
   ```bash
   git checkout develop
   git pull origin develop
   git merge --no-ff hotfix-fix-login-redirect
   git push origin develop
   ```

4. **Tag (optional)**  
   If you version hotfixes: `git tag -a v1.2.1 -m "Hotfix: login redirect"` and push the tag.

5. **Delete hotfix branch**  
   `git branch -d hotfix-fix-login-redirect` (and remote delete if pushed).

---

## Protecting main (production)

- **Branch protection:** On GitHub/GitLab, enable branch protection for **main**:
  - Require **2–3 approvals** (your choice) for Pull Requests into main.
  - Require status checks to pass (e.g. CI) before merge.
  - Restrict who can push/merge to main (e.g. maintainers only), or require PRs for everyone.
- **Develop:** Can be protected too (e.g. 1 approval, or allow merges from feature branches after review).

---

## Visual summary

```
main     ----*----------------*--------*--------*  (production)
               \              /        ^
develop  -------*---*---*----*--------/ \       (sprint integration)
                     \  \   \           \
feature-A              \  \   \           \
feature-B               \  \   *--*        \
release-2.0              \  \        \      *
                          \  *--*      *---/
hotfix                     (hotfix)   (release merge)
```

- **feature** branches branch from **develop** and merge back into **develop**.
- **release** branches branch from **develop**, then merge into **main** and back into **develop**; then tag and delete.
- **hotfix** branches branch from **main**, merge into **main** and **develop**, then delete.

---

## Summary

| Action | Branch from | Merge into |
|--------|-------------|------------|
| New feature | develop | develop |
| Release | develop | main, then develop |
| Hotfix | main | main and develop |

**Single repo:** Backend (Railway) and frontend (Vercel) both use this repo; set each project’s root to `backend` and `frontend` respectively, and connect production to **main**.
