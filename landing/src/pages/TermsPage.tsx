import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { parseLegalDocument } from "../lib/legal";
import termsContent from "./notesify-terms.md?raw";

const termsDocument = parseLegalDocument(termsContent);

export const TermsPage = () => {
  return (
    <LegalPageLayout
      seo={{
        title: "Terms of Service — Notesify",
        description:
          "The terms that govern your use of Notesify, including accounts, user content, Iris AI features, and service limitations.",
        keywords:
          "notesify terms of service, terms of use, notesify policy, iris ai terms",
        path: "/terms",
      }}
      document={termsDocument}
      activeDocument="terms"
      eyebrow="Terms & Conditions"
      headline="Terms of Service"
      summary="The agreement that governs your use of Notesify, written to be read rather than skimmed past."
      highlights={[
        {
          label: "You own your content",
          description:
            "You retain full ownership of the notes and study materials you create.",
          href: "#user-content-and-intellectual-property",
        },
        {
          label: "Keep your account secure",
          description:
            "You are responsible for your credentials and for reporting unauthorized access.",
          href: "#accounts-and-authentication",
        },
        {
          label: "Verify AI output",
          description:
            "Iris can be wrong. Review generated content before you rely on it.",
          href: "#ai-assistant-features-iris",
        },
        {
          label: "Service is provided as-is",
          description:
            "Notesify does not guarantee uninterrupted or error-free operation.",
          href: "#limitation-of-liability-and-as-is-service",
        },
      ]}
      contact={{
        label: "Terms contact",
        heading: "Questions about these terms?",
        description:
          "Ask about the agreement, account access, or how these terms apply to your use of Notesify.",
        email: "badalsahani233@gmail.com",
      }}
      related={{
        label: "Privacy Policy",
        to: "/privacy",
        description: "How Notesify collects, uses, and protects your information.",
      }}
      footerNote="© 2026 Notesify. All rights reserved. These terms are reviewed when Notesify's service or policies change."
    />
  );
};
