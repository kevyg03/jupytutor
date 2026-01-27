## What does this PR do?

> What are the overall goals of this pull request? Which parts of the application does this PR change?

Be sure to link to the relevant issue, if one exists.

---

## Screenshots

Include screenshots if any visual changes are made.  
If it makes sense, animations are great too!

---

## How should this be manually tested?

Outline the steps to test the PR or reproduce the bug here.

This is optional only if it's a really small change where the description of the new behavior is sufficient. If there's any special behavior or edge cases to be aware of, be sure to include steps to activate that behavior.

---

## Tests

- [ ] I've included tests with this PR
- [ ] I'll include tests with another PR (link to GH issue for these tests)
- [ ] Tests aren't needed for this change (explain why)

---

## Related PRs

Are there any dependencies between this PR and another?

- If there are API changes, how will a new client interact with an old server?
- How will an old client interact with a new server?
- What order should deployments happen in?

---

## Risks

Are there any concerns about deploying this PR?

- Any manual database changes needed before deploying? Migrations?
- Does this change the data format sent from the frontend to the backend, or from the backend to the frontend in a backwards-incompatible way?
- Does this require a multi-stage deploy that needs to be coordinated?
- Does this PR introduce accessibility concerns?

Any other things to watch out for, possible errors, unhandled edge cases, etc.

---

## Checklist

- [ ] I've resolved all linter violations (except when I have a question about a specific rule)
- [ ] I've validated any UI changes in dark and light mode
- [ ] I've validated any UI changes in the Jupyter Lab and single-column notebook views
- [ ] I've reviewed the entire diff for the PR for dead code, typos, overly complicated code, etc.
- [ ] I've added GitHub comments on code for which I want specific feedback or which warrant extra explanation
- [ ] I've requested a review if ready, or if changes have been made in response to a review

