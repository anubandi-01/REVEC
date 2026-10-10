<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Demo mode has no sign-in: the browser parses files and keeps rows/results in localStorage; server functions in src/lib/datasets.functions.ts only run AI and verification. Why: the owner asked for a login-free demo.
- AI proposes labels/themes; src/lib/analysis-core.ts computes every count/percentage and verifies quotes as exact substrings of the cited row. Why: the product's credibility rests on deterministic, verifiable evidence.
- Keep upload-page product context and demo-use/privacy disclosures in UploadAbout below the primary workflow, using the existing accordion. Why: supplementary information stays accessible without adding routes or distracting from uploading.
