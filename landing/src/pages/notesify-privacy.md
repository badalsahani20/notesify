# Privacy Policy

**Last updated: November 9, 2026**

At Notesify, we believe your ideas and personal information deserve respect. Notes, documents, conversations, and learning materials can contain information that is deeply personal or professionally important. We take that responsibility seriously.

This Privacy Policy explains how Notesify collects, uses, stores, processes, and shares personal information when you access our website, applications, and services.

Notesify is an AI-powered note-taking and learning workspace that allows you to create and organize notes, interact with an AI assistant, generate learning materials, research information, and access your workspace across supported devices.

By using Notesify, you acknowledge that you have read this Privacy Policy.

---

## 1. Information We Collect

We collect information that is necessary to provide, maintain, secure, and improve Notesify.

### 1.1 Account Information

When you register or sign in, we may collect:

- Name
- Email address
- Profile picture or avatar
- Authentication provider and associated account identifier
- Account verification status
- Account creation and modification timestamps

Notesify supports email-based authentication and Google OAuth.

When you authenticate using Google, we receive the profile information necessary to establish and manage your Notesify account.

We do not request access to your Google Drive, contacts, calendar, or other private Google resources as part of the standard sign-in process.

### 1.2 User-Generated Content

When you use Notesify, we collect and process the content you choose to create, upload, or store, including:

- Notes, drafts, and rich-text content
- Notebook and folder structures
- Tags, organization metadata, and preferences
- Uploaded images and documents
- AI conversations and associated interaction history
- Generated quizzes and flashcards
- Content you choose to share publicly
- Preferences or contextual information you explicitly ask Iris to remember

This information is required to provide the core functionality of Notesify.

Your content is associated with your account so that it can be retrieved, edited, organized, and synchronized across supported devices.

### 1.3 Authentication and Security Information

For account security and authentication, we may process:

- Password hashes
- Hashed refresh-token records
- Email verification tokens and codes
- Password-reset tokens and their expiration information
- Session and authorization state

Passwords are hashed using bcrypt rather than stored as readable passwords.

Refresh tokens and verification credentials are protected through hashing before being stored where applicable.

### 1.4 AI Usage and Service Metadata

To maintain service reliability and manage AI usage, Notesify may store operational information such as:

- AI request counts
- Input and output token usage estimates
- Model and provider usage breakdowns
- Daily usage counters
- Request and synchronization metadata
- Error and diagnostic information

This information helps enforce usage limits, monitor service performance, troubleshoot failures, and maintain fair access to AI functionality.

### 1.5 Technical Information

When you access Notesify, our infrastructure and application may process technical information necessary for service delivery, including browser and device characteristics, request metadata, and security-related logs.

We use such information to maintain application functionality, investigate errors, prevent abuse, and protect our infrastructure.

---

## 2. How We Use Your Information

We use collected information only for legitimate service-related purposes, including:

**Account management**

- Creating and maintaining your account.
- Authenticating your identity.
- Managing sessions and account recovery.
- Sending essential account-related communications.

**Core application functionality**

- Saving and organizing notes.
- Synchronizing content across supported devices.
- Managing folders, attachments, and learning materials.
- Maintaining local and cloud workspace consistency.

**AI-powered functionality**

- Processing requests submitted to Iris.
- Generating summaries, explanations, and writing suggestions.
- Generating quizzes and flashcards.
- Analyzing documents and relevant note content.
- Performing user-requested web research.

**Security and reliability**

- Detecting suspicious activity.
- Preventing unauthorized access.
- Managing usage limits and concurrency.
- Diagnosing errors and improving application stability.

**Legal and operational requirements**

- Responding to valid legal requests.
- Enforcing applicable service terms.
- Protecting Notesify, its users, and its infrastructure.

We do not sell your personal information or user-generated content.

We do not use private user content to train our own foundation AI models.

---

## 3. Data Storage and Infrastructure

Notesify uses a combination of cloud infrastructure and local device storage.

### 3.1 Cloud Database

We use MongoDB Atlas to store account information, notes, folders, AI conversation records, attachment metadata, and other application-related information.

Database access is restricted through application-level authorization and infrastructure access controls.

### 3.2 Caching and Temporary State

Notesify uses Upstash Redis for temporary application operations, including:

- Authentication and OAuth-related state.
- Short-lived application caches.
- Note and folder listing caches.
- Publicly shared note-page caches.

Cached information is used to improve application performance and reduce unnecessary database operations.

Caching does not replace the primary database as the source of persistent account and workspace information.

### 3.3 Local Storage and Offline-First Functionality

Notesify supports offline-first functionality on supported applications.

To provide this experience, information may be stored locally on your device using IndexedDB through Dexie.

Local information may include:

- Cached notes and folders.
- Locally created or modified content.
- Pending synchronization operations.
- Temporary synchronization metadata.

When connectivity is restored, Notesify attempts to synchronize pending changes with the cloud service.

Local copies may remain on your device after signing out or when cloud content is deleted. Clearing browser or application storage may remove locally stored information.

If you use a shared device, we recommend signing out and clearing locally stored application data when appropriate.

### 3.4 Image and Document Storage

Images uploaded within Notesify are stored and delivered using Cloudinary.

When you upload PDF documents through supported AI attachment features:

- The original files are uploaded to Cloudinary.
- Text is extracted from supported PDF documents.
- Extracted text and attachment metadata are stored in our application database.
- Relevant document content may be included in an AI request when you use features that process those documents.

Uploaded files are associated with your account and used to provide the requested functionality.

### 3.5 Cookies and Authentication Storage

The Notesify web application uses essential browser cookies and related storage mechanisms to support authentication and session management.

Authentication cookies use security-related attributes, including HttpOnly, Secure in production, and appropriate SameSite settings.

Supported desktop and mobile applications may use application-specific local storage mechanisms to maintain authentication state.

These mechanisms are necessary for certain features to function correctly.

### 3.6 Security Measures

We implement reasonable technical safeguards to protect information, including:

- Password hashing.
- Hashed refresh-token storage.
- Token rotation.
- Authentication and authorization checks.
- Secure communication mechanisms.
- Input validation and content sanitization.
- Access restrictions on user-specific resources.

We continuously work to improve the security of Notesify.

However, no electronic storage system or internet transmission can be guaranteed to be completely secure.

---

## 4. AI Features and Iris

Notesify includes an AI assistant called Iris, designed to help users understand, organize, research, and work with their content.

AI functionality may include:

- Conversational assistance.
- Note-aware question answering.
- Writing and editing suggestions.
- Summarization and explanations.
- Automatic title generation.
- Quiz and flashcard generation.
- PDF and image understanding.
- Web search and webpage analysis.
- Contextual workspace operations.

### 4.1 How AI Processing Works

When you use an AI feature, Notesify processes the information necessary to fulfill your request.

Depending on the operation, this may include:

- Your prompt or instruction.
- Selected note content.
- Relevant conversation history.
- Retrieved information from your workspace.
- Uploaded document text or images.
- Other contextual information required by the requested operation.

For example, when you ask Iris a question about a particular note, relevant note content may be retrieved and included in the AI request.

Iris may also use workspace tools to search notes, create content, or perform other explicitly requested operations.

Notesify does not automatically submit your entire workspace to an AI provider for every interaction.

### 4.2 AI Providers

Notesify uses a provider-routing architecture rather than depending on a single AI model.

Depending on the feature and configuration, AI processing may involve:

- OpenRouter
- Google Gemini
- Groq
- Other supported model infrastructure or providers

The specific model and provider may change based on availability, performance, capability, and service configuration.

Your AI request may be routed through an intermediary service before reaching the underlying model provider.

### 4.3 Third-Party AI Data Processing

When an AI request is processed by an external provider, the relevant prompt, context, documents, or other necessary input may be transmitted to that provider.

External AI providers operate under their own terms, privacy policies, and data-processing practices.

Depending on the provider and its configuration, request and response information may be retained for operational, security, abuse-prevention, or other purposes permitted under its applicable policies.

Notesify does not independently control every provider's internal retention or data-handling practices.

We do not guarantee that all underlying AI providers apply identical data-retention or model-training policies.

For this reason, we recommend avoiding the submission of passwords, payment credentials, government identification numbers, or highly sensitive confidential information through AI features.

### 4.4 AI Conversations and History

Notesify may retain AI conversations to provide conversation history and contextual continuity.

Conversation records may contain:

- User messages.
- AI-generated responses.
- Associated tool-call information.
- Conversation summaries.
- Relevant interaction metadata.

Older conversation context may be summarized to manage context limits while preserving useful continuity.

AI-generated content and cached AI assistance results may also be stored as part of application functionality.

### 4.5 AI Memory

When you explicitly ask Iris to remember a preference or other supported information, Notesify may store that information to provide continuity in future interactions.

Saved information is used to support relevant AI interactions.

### 4.6 AI-Generated Content

AI-generated responses, summaries, suggestions, quizzes, and other outputs are provided as assistance.

AI-generated information may contain errors, omissions, or inaccuracies.

You are responsible for reviewing and verifying AI-generated content before relying on it, publishing it, or sharing it.

---

## 5. Web Search and External Content

Iris supports web research and webpage retrieval.

When you request web research:

- Your search query may be transmitted to an external search provider.
- Search providers may return publicly available information and website references.
- When you request webpage analysis, the requested URL may be accessed to retrieve its content.
- Retrieved content may subsequently be processed by an AI provider to generate a response.

Notesify may use providers such as Exa, Parallel, or integrated search capabilities depending on the active configuration.

Our webpage retrieval functionality is designed to access publicly available HTTP or HTTPS resources.

Notesify does not control the privacy policies, accuracy, availability, or content of external websites and search providers.

---

## 6. Public Note Sharing

Notesify provides functionality that allows users to share selected notes through public sharing links.

When you enable public sharing:

- The selected note may become accessible to people who possess its share link.
- Information contained within the shared note may be visible to those visitors.
- Publicly shared pages may use temporary caching to improve loading performance.

You should carefully review a note before making it publicly accessible.

Do not include confidential, personal, or sensitive information in a note that you intend to share publicly.

Publicly shared content may be copied, downloaded, or redistributed by people who gain access to it.

Notesify cannot control how recipients use information after they have accessed it.

---

## 7. Third-Party Services

Notesify relies on external providers to deliver its functionality.

Depending on the feature you use, information may be processed by the following categories of providers:

| Service provider              | Purpose                                            |
| ----------------------------- | -------------------------------------------------- |
| Google                        | Google OAuth authentication and Gemini AI services |
| OpenRouter                    | AI model routing and inference access              |
| Groq                          | AI inference services                              |
| MongoDB Atlas                 | Cloud database infrastructure                      |
| Upstash                       | Caching and temporary application state            |
| Cloudinary                    | Image and document storage and delivery            |
| Exa / Parallel                | Web search and research                            |
| SMTP email provider           | Account verification and transactional emails      |
| Application hosting providers | Backend and frontend infrastructure                |

These services may process information necessary to perform their respective functions.

Their processing is subject to their applicable privacy policies, terms, and service arrangements.

Some providers may process or store information on infrastructure located outside your country of residence.

Notesify does not sell personal information to these providers.

---

## 8. Data Retention and Deletion

We retain personal information for as long as reasonably necessary to provide Notesify, maintain security, fulfill operational requirements, and comply with applicable legal obligations.

### 8.1 Notes and Workspace Content

You may modify, archive, or delete supported content through the application.

Deleted content may be removed from active systems according to the relevant application and deletion processes.

### 8.2 AI Conversations

AI conversation history may remain associated with your account until it is deleted through supported functionality or as part of an account-deletion request.

Associated summaries and cached AI results may also contain information derived from your interactions.

### 8.3 Account Deletion

You may request permanent deletion of your Notesify account by contacting us.

To protect your account, we may request verification before processing a deletion request.

Following verification, we will initiate deletion of associated personal information and user-generated content from active systems, subject to applicable legal, security, and operational requirements.

### 8.4 Backups and Temporary Data

Certain information may remain temporarily in:

- Database backups.
- Temporary caches.
- Diagnostic and security records.
- Third-party service infrastructure.

Such information may persist until the applicable retention or cleanup process removes it.

We do not promise instantaneous deletion from every backup or external provider.

---

## 9. Your Privacy Rights and Choices

We believe users should have meaningful control over their information.

Depending on applicable law, you may have the right to:

- Request access to personal information associated with your account.
- Request correction of inaccurate information.
- Request deletion of personal information.
- Withdraw consent where processing is based on consent.
- Request information about how your data is processed.
- Raise privacy-related concerns or grievances.

You can manage and delete supported workspace content directly through Notesify.

For account-related requests, personal information inquiries, or privacy concerns, contact us using the details in the Contact section.

We may request reasonable verification to protect your account and prevent unauthorized requests.

We aim to handle privacy requests in accordance with applicable data-protection requirements.

---

## 10. International Data Processing

Notesify uses third-party cloud and infrastructure providers that may operate in different countries.

As a result, your information may be transferred to, stored in, or processed outside your country of residence.

Where applicable, such processing is subject to relevant contractual, technical, and legal safeguards.

---

## 11. Children's Privacy

Notesify is designed to support learning, education, productivity, and personal knowledge management. We recognize that these features may also be useful to individuals under the age of 18.

Individuals under 18 may use Notesify where permitted by applicable law and subject to any required parental or legal guardian consent.

Where applicable, Notesify will take appropriate measures to obtain and verify parental or guardian consent before processing children's personal information.

We do not knowingly process children's personal information in violation of applicable data-protection requirements.

Parents and legal guardians who have questions about a child's use of Notesify or wish to request access, correction, or deletion of their child's personal information may contact us at:

**Email:** [badalsahani233@gmail.com](mailto:badalsahani233@gmail.com)

---

## 12. Changes to This Privacy Policy

As Notesify evolves, we may introduce new functionality, integrate additional providers, or change existing data-processing practices.

We may update this Privacy Policy to reflect those changes or comply with applicable legal requirements.

Material changes will be communicated through the application, website, or another appropriate communication channel.

The latest revision date will be displayed at the beginning of this policy.

We encourage users to review this page periodically.

---

## 13. Contact and Privacy Requests

For questions about this Privacy Policy, account deletion, access or correction requests, or privacy-related concerns, contact:

**Privacy Contact:** Notesify

**Email:** [badalsahani233@gmail.com](mailto:badalsahani233@gmail.com)

**Website:** [https://www.notesify.in](https://www.notesify.in)

Please include sufficient information to help us identify your account and understand your request. Avoid sending passwords or other sensitive credentials through email.

We will review privacy-related requests and respond within a reasonable period, subject to applicable legal requirements.
