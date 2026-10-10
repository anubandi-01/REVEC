import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const sections = [
  {
    id: "about",
    title: "About Revec.ai",
    text: "Don't just read reviews. Know what to improve. Revec.ai turns customer reviews and survey responses into sentiment, keywords, recurring themes and evidence-backed recommendations, with a report you can download. This is a no-login demo; the three sample datasets are fictional and use the same analysis pipeline as your own file.",
  },
  {
    id: "story",
    title: "The story behind it",
    text: "The problem is simple: a spreadsheet full of customer voices is not yet a decision. Skimming can favour the loudest complaint and miss a recurring issue. Revec's product idea is to connect a proposed improvement to the original feedback that supports it. Maya's board-meeting story on the landing page illustrates this problem; she is not a real customer or a testimonial.",
  },
  {
    id: "why-now",
    title: "Why now?",
    text: "AI can help organise open-ended feedback, but a convincing summary is not enough to trust a decision. Teams also need to check the numbers and see the source. Revec combines AI-assisted reading with deterministic counting and exact quotation checks, keeping the evidence attached to the recommendation.",
  },
];

const capabilities = [
  ["01", "Upload & validate", "CSV and Excel parsing, column selection, record previews, duplicate checks and stable review IDs."],
  ["02", "Sentiment", "AI classifies responses; application code calculates the sentiment totals and percentages."],
  ["03", "Keywords", "Extracted phrases are checked against the feedback and counted from the analysed records."],
  ["04", "Themes", "Ranked recurring themes with counts, percentages and traceable source excerpts."],
  ["05", "Recommendations", "Actions grounded in verified themes; possible causes labelled as hypotheses, not facts."],
  ["06", "Report", "Inspect original responses, then download the evidence-backed report as PDF or Markdown."],
];

export function UploadAbout() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <p className="font-mono text-xs uppercase text-primary">Behind the analysis</p>
        <h2 className="font-display mt-3 text-4xl sm:text-5xl">A decision deserves evidence.</h2>
        <Accordion type="multiple" className="mt-8">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="gap-4 py-5 text-base">{section.title}</AccordionTrigger>
              <AccordionContent className="max-w-3xl leading-relaxed text-muted-foreground">{section.text}</AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="innovation">
            <AccordionTrigger className="gap-4 py-5 text-base">What's innovative · end-to-end features</AccordionTrigger>
            <AccordionContent>
              <p className="max-w-3xl leading-relaxed text-muted-foreground">AI proposes the interpretation; code checks the evidence. Every displayed quote must match its cited response word for word, and unsupported evidence is removed. This verifies the citation—not the truth of a customer's statement or the accuracy of every AI interpretation.</p>
              <ol className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {capabilities.map(([number, title, text]) => (
                  <li key={number} className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs text-primary">{number}</span>
                    <div><h3 className="font-medium">{title}</h3><p className="mt-1 leading-relaxed text-muted-foreground">{text}</p></div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="terms">
            <AccordionTrigger className="gap-4 py-5 text-base">Terms & conditions · demo use</AccordionTrigger>
            <AccordionContent className="max-w-3xl space-y-3 leading-relaxed text-muted-foreground">
              <p>Use only feedback you have permission to process. Do not upload confidential information, sensitive personal data or content you are not authorised to share with a third-party AI service.</p>
              <p>AI classifications, themes and recommendations can be incorrect or incomplete. Review the source evidence before acting; outputs are decision support, not professional advice or guaranteed outcomes.</p>
              <p>This demo may fail or become unavailable. Reports remain in this browser until deleted or browser data is cleared; download anything you need to keep. A report link does not make the report available on another device.</p>
              <p className="text-xs">These are demo-use guidelines, not a complete legal agreement. Operator details and jurisdiction-specific terms must be confirmed before commercial use.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="privacy">
            <AccordionTrigger className="gap-4 py-5 text-base">Data privacy · no login doesn't mean no risk</AccordionTrigger>
            <AccordionContent className="max-w-3xl space-y-3 leading-relaxed text-muted-foreground">
              <p><strong className="text-foreground">In your browser.</strong> Your spreadsheet is parsed locally rather than saved to file storage. Original responses and completed results are saved in this browser's local storage, without automatic expiry. Anyone using the same browser profile may be able to access them.</p>
              <p><strong className="text-foreground">For AI processing.</strong> Selected review text and source IDs are sent through Revec's server and the Lovable AI gateway to an AI provider. Theme generation also receives the prepared records, including selected rating, category and date fields. Removing sign-in avoids collecting account details; it does not make this processing anonymous.</p>
              <p><strong className="text-foreground">Before uploading.</strong> Remove names, emails, phone numbers and other identifying or sensitive information from both the feedback and optional columns. Use the fictional samples if you are unsure you have permission.</p>
              <p><strong className="text-foreground">Retention & deletion.</strong> Delete a report on the results page or clear this site's browser data to remove the local copy. This does not delete downloaded files or any service-side logs. AI provider and gateway retention, training use and processing locations have not been verified here; no zero-retention or full-compliance guarantee is made.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="mt-6 text-xs text-muted-foreground">Revec.ai · Customer feedback, with the evidence attached.</p>
      </div>
    </footer>
  );
}