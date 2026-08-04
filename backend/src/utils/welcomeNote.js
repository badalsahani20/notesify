export const getWelcomeNote = () => ({
  title: "Welcome to Notesify! 🚀",
  content: `
<h1>👋 Wait, You Actually Signed Up?</h1>
<p>Look at you—already getting your life together.</p>
<p>I'm <strong>Notesify</strong>, and since you're here... I guess we're friends now. <em>(Sorry, Netflix.)</em></p>
<p>This note isn't just here to say hello—it's your playground. Almost everything below is meant to be clicked, selected, or experimented with.</p>

<hr />

<h1>🎯 Rookie Mission</h1>
<p>Complete these tiny challenges to learn your way around.</p>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="false"><p>Create your first notebook</p></li>
  <li data-type="taskItem" data-checked="false"><p>Create another note</p></li>
  <li data-type="taskItem" data-checked="false"><p>Highlight the blue sentence below</p></li>
  <li data-type="taskItem" data-checked="false"><p>Move this note into a notebook using drag &amp; drop</p></li>
  <li data-type="taskItem" data-checked="false"><p>Open Iris and ask her a question</p></li>
  <li data-type="taskItem" data-checked="false"><p>Press <strong>Ctrl + K</strong> and search for <strong>Pizza</strong></p></li>
</ul>
<p>You'll know most of Notesify before you even realize it.</p>

<hr />

<h1>🎨 Your First Experiment</h1>
<blockquote><p><strong>"I'm just an ordinary line of text... or am I?"</strong></p></blockquote>
<p>Select this sentence.</p>
<p>Click the <strong>Highlighter</strong> button.</p>
<p>Give me your favorite color.</p>
<p>Congratulations—you've already customized your first note.</p>

<hr />

<h1>✨ Meet Iris</h1>
<p>Iris is more than an AI chatbot—she's your personal study companion.</p>
<p>Select any paragraph in this note and click <strong>Ask Iris</strong>. No copy-pasting required.</p>
<p>She can explain concepts, summarize notes, improve writing, generate Mermaid diagrams, debug code, and even build complete study material.</p>

<h3>📝 Generate Study Notes</h3>
<p>Choose exactly how you want your notes to be written.</p>

<p><strong>📚 Study Structure</strong></p>
<ul>
  <li><p>Detailed Structured Notes</p></li>
  <li><p>Revision Crash Sheet</p></li>
  <li><p>Concept + Intuition Mode</p></li>
  <li><p>Interview Prep Notes</p></li>
</ul>

<p><strong>🎙️ Explanation Tone</strong></p>
<ul>
  <li><p>Academic</p></li>
  <li><p>Technical / Precise</p></li>
  <li><p>Beginner-Friendly</p></li>
  <li><p>Simple / Analogy-Rich</p></li>
  <li><p>Exam-Oriented</p></li>
  <li><p>Q&amp;A Style</p></li>
</ul>

<p><strong>📏 Study Depth</strong></p>
<ul>
  <li><p>Quick Revision</p></li>
  <li><p>Standard</p></li>
  <li><p>Deep Dive</p></li>
</ul>

<pre><code class="language-mermaid">flowchart LR
    A[📄 Raw Notes]
    --> B[📚 Structure]
    --> C[🎙️ Tone]
    --> D[📏 Depth]
    --> E[✨ Study Notes]</code></pre>

<h3>🎓 Study Mode</h3>
<p>Finished reading?</p>
<p>Open <strong>Study Mode</strong> from the top-right corner.</p>
<p>Iris instantly turns your notes into:</p>
<ul>
  <li><p>✅ Multiple Choice Questions</p></li>
  <li><p>✅ True / False Quizzes</p></li>
  <li><p>✅ Flashcards</p></li>
</ul>

<pre><code class="language-mermaid">flowchart LR
    A[📖 Read Notes]
    --> B[🎓 Study Mode]
    --> C[📝 MCQs]
    B --> D[✔️ True / False]
    B --> E[🗂️ Flashcards]</code></pre>

<hr />

<h1>🧠 Ideas Look Better Visually</h1>
<p>Turn messy thoughts into clear diagrams.</p>
<pre><code class="language-mermaid">mindmap
  root((Notesify))
    Notes
      Rich Text
      Code
      Tables
    AI
      Study Notes
      Quizzes
      Flashcards
      Mermaid
    Organization
      Notebooks
      Search</code></pre>

<hr />

<h1>💻 Pretty Code Deserves Pretty Colors</h1>
<pre><code class="language-javascript">function breakTheFourthWall() {
  console.log("Nice shirt, by the way.");

  return {
    status: "Mind Blown",
    companion: "Iris"
  };
}</code></pre>

<hr />

<h1>📊 Tables Work Too</h1>
<table>
  <thead>
    <tr>
      <th>Feature</th>
      <th>Why You'll Love It</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Rich Notes</td>
      <td>Beautiful formatting without the hassle</td>
    </tr>
    <tr>
      <td>Iris AI</td>
      <td>Study notes, summaries, explanations &amp; diagrams</td>
    </tr>
    <tr>
      <td>Study Mode</td>
      <td>MCQs, Flashcards &amp; True/False quizzes</td>
    </tr>
    <tr>
      <td>Mermaid</td>
      <td>Visualize ideas in seconds</td>
    </tr>
    <tr>
      <td>Search</td>
      <td>Find anything instantly</td>
    </tr>
  </tbody>
</table>

<hr />

<h1>🚀 You're Ready</h1>
<p>You've already explored rich text, code blocks, tables, Mermaid diagrams, Study Mode, and met Iris.</p>
<p>Feel free to keep this note around while you're exploring—you can always delete it later.</p>
<p>Now go build something awesome.</p>
<p>Or a list of cat names.</p>
<p>Both are valid.</p>
<p>Happy note-taking. ✨</p>
  `,
});
