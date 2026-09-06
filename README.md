# AI Automate Hub

Build a web app called Go Automate. It's a premium AI-powered company automation screener, designed to feel like an internal diagnostic tool built by a top-tier AI consulting firm, sleek, confident, and data-driven.

The landing screen has a bold hero section with the product name Go Automate, a tagline reading "See where AI can transform your business in sixty seconds," and a clean input area below it with a text field for the company name and an optional text area for a company description, with a prominent call-to-action button labeled Run Diagnostic.

When submitted, transition to a results dashboard. At the top, show the overall automation score using a horizontal bar visual, a long thin rectangular track like a chocolate bar or a progress rail, running from a label reading Manual on the far left to a label reading Highly Automatable on the far right, with a solid dark filled dot or marker positioned along that track based on the score, so the further right the marker sits, the higher the automation potential. Underneath the bar, show the numeric score out of one hundred and a short qualitative label like High Automation Potential.

Below that, include a two to three sentence summary of what the company does and its position in its industry. Then a section titled Automation Opportunities, showing three to five individual workflow cards. Each card should have its own smaller version of the same horizontal bar and moving dot to show how automatable that specific workflow is, along with the workflow name, a one sentence description of how it's done manually today, and a one sentence suggested AI-driven approach to automating it. Finally, include a section titled Recommended Stack that lists specific real AI tools or platforms relevant to each workflow.

Design system: near-black background, white and light gray text, one sharp accent color such as electric blue or lime green used specifically for the bar fill and the moving dot marker so it visually pops against the dark background, generous whitespace, rounded corners, subtle shadows, and smooth animation when the dot slides into position after the diagnostic runs. It should feel like a real funded AI startup product, not a hackathon demo.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b6318654-e6d8-4308-bf34-8d3e24e9bd80).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
