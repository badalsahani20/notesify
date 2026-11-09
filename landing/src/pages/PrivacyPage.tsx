import { LegalPageLayout } from "../components/legal/LegalPageLayout";
import { parseLegalDocument } from "../lib/legal";
import privacyContent from "./notesify-privacy.md?raw";

const privacyDocument = parseLegalDocument(privacyContent);

export const PrivacyPage = () => {
  return (
    <LegalPageLayout
      seo={{
        title: "Privacy Policy — Notesify",
        description:
          "How Notesify collects, uses, stores, and protects your information across notes, AI features, and supported devices.",
        keywords:
          "notesify privacy policy, data protection, notesify security, iris ai privacy",
        path: "/privacy",
      }}
      document={privacyDocument}
      activeDocument="privacy"
      eyebrow="Privacy & Trust"
      headline="Your ideas are yours."
      summary="Understand how Notesify handles your information — from the notes you write to the AI features you choose to use."
      highlights={[
        {
          label: "No data selling",
          description:
            "We do not sell your personal information or user-generated content.",
          href: "#how-we-use-your-information",
        },
        {
          label: "No training of our models",
          description:
            "Private content is not used to train our own foundation models. External AI providers follow their own policies.",
          href: "#how-we-use-your-information",
        },
        {
          label: "You control public sharing",
          description:
            "Only notes you explicitly make public can be opened through a share link.",
          href: "#public-note-sharing",
        },
        {
          label: "Deletion on request",
          description:
            "You can request permanent deletion of your account and associated content.",
          href: "#data-retention-and-deletion",
        },
      ]}
      contact={{
        label: "Privacy contact",
        heading: "Questions about privacy?",
        description:
          "Ask about this policy, your data, or an account-deletion request. We will review it and respond within a reasonable period.",
        email: "badalsahani233@gmail.com",
      }}
      related={{
        label: "Terms of Service",
        to: "/terms",
        description: "The agreement that governs your use of Notesify.",
      }}
      footerNote="© 2026 Notesify. All rights reserved. This policy is reviewed when Notesify's data practices change."
    />
  );
};
