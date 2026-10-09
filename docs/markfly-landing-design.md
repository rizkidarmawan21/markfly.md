# Markfly Landing Page Design

## Status

Design approved in chat. This spec is awaiting user review before implementation planning.

## Goal

Create a simple, standalone marketing site for Markfly. Show the real app in the hero and guide macOS users to download it. Keep the website source in a separate repository from the Markfly app repository.

## Agreed constraints

- One page with exactly four content sections.
- Hero shows a large Markfly app screenshot immediately.
- Use the Dribbble reference for layout rhythm and product-preview placement, not as a visual asset: https://cdn.dribbble.com/userupload/42933146/file/original-7c10a1928e2c6dcfb7277795f828a63f.png?resize=752x&vertical=center
- Use the existing `design.md` unchanged as the design system. Copy it byte-for-byte into the separate website repository.
- Keep the page short. No pricing, testimonial, customer-logo, or statistics sections.
- User supplied app screenshots and brand imagery may be cropped and composed to fit the page.

## Page structure

### Header

Compact navigation inside the hero: cropped Markfly wordmark, Features and How it works anchors, and a coral Download button. Header is not a separate content section.

### 1. Hero

Centered headline and one-sentence product description. Primary CTA opens the latest GitHub Release; secondary CTA may link to the source repository. Place the supplied Markfly app screenshot in a large rounded product frame, visually overlapping the lower edge of a soft warm hero backdrop. The screenshot must remain legible and recognizable as the real app.

### 2. Features

Three concise feature highlights, based on shipped capabilities:

- Native macOS workflow for Markdown files.
- Rich Markdown rendering, including Mermaid diagram, code, and split modes.
- Document search and copy rendered content as Markdown.

Use a close crop from the supplied Mermaid screenshot as the supporting product detail. Do not add abstract illustrations when a real app crop explains the feature.

### 3. How it works

Three short steps: open a Markdown file, read the rendered preview, then search or copy what is needed. Use a compact horizontal sequence on desktop and a vertical sequence on narrow screens.

### 4. Download and footer

One closing CTA to the latest GitHub Release, with macOS and Apple Silicon compatibility stated from release metadata. Keep repository, release, and copyright links in a compact footer within this section.

## Visual direction

Use the approved `design.md` palette and typography: warm cream canvas, restrained coral actions, serif display headlines, sans-serif body, and dark product surfaces. Borrow the reference's generous whitespace, centered hero, prominent overlapping product preview, rounded content panels, and strong closing CTA. Do not carry over its purple palette or its many content bands.

## Asset map

- `build/icon.png`: app icon; use for favicon and compact brand mark where suitable.
- User supplied `Minimal markfly.md Logo Banner-modified.png`: crop tightly around the wordmark for navigation and footer. Avoid showing excess white canvas.
- User supplied app screenshot showing Mermaid modes: use as the hero product visual and crop a close detail for Features.
- Other supplied README screenshot: do not use as hero source; it contains a smaller screenshot nested inside another app view.
- No stock photography, testimonial portraits, or custom illustration required.

Keep source assets intact. Prefer responsive CSS crops and `object-position` over destructive edits. Optimize exported web images while keeping original user assets available in the website repository.

## Site behavior and implementation boundary

- Static, single-page site. No backend, CMS, forms, accounts, or application state.
- Navigation uses in-page anchors. Download CTA points to `https://github.com/rizkidarmawan21/markfly.md/releases/latest`.
- Responsive layout must preserve the app screenshot's legibility on mobile; crop nonessential window chrome only when required.
- Use semantic headings, descriptive image alt text, visible focus states, and sufficient contrast.
- Load the hero screenshot eagerly; defer lower-page imagery.

## Assumptions and open decisions

- Proposed site language: English, matching the current app UI and README.
- Proposed implementation: lightweight static site with HTML/CSS and minimal JavaScript; no runtime framework required for this page.
- Website repository name/remote, hosting provider/domain, and font-file availability are not selected yet. Resolve these before writing the implementation plan.
- If licensed webfonts named by `design.md` are unavailable, select close freely licensed alternatives while preserving its typography direction.

## Acceptance criteria

- Exactly four content sections; hero product screenshot visible before scrolling on desktop.
- Layout follows the referenced composition while using Markfly assets and the shared `design.md` style.
- Shared `design.md` in the website repository is byte-for-byte identical to the app repository copy.
- Download CTA opens the latest release page.
- Mobile layout remains readable and keeps all primary content and the download action accessible.
- No pricing, testimonials, customer logos, invented metrics, or extra marketing bands.
