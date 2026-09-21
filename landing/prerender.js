import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toAbsolute = (p) => path.resolve(__dirname, p);

async function prerender() {
  console.log('Starting static prerendering process...');

 
  const templatePath = toAbsolute('dist/index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Client build template not found at: ${templatePath}. Did build:client run successfully?`);
  }
  const template = fs.readFileSync(templatePath, 'utf-8');

  // Import the render function from the server bundle
  const serverBundlePath = toAbsolute('dist-server/entry-server.js');
  if (!fs.existsSync(serverBundlePath)) {
    throw new Error(`Server build bundle not found at: ${serverBundlePath}. Did build:server run successfully?`);
  }
  const { render } = await import(pathToFileURL(serverBundlePath).href);

  const routesToPrerender = [
    { path: '/', file: 'index.html' },
    { path: '/docs', file: 'docs.html' },
    { path: '/terms', file: 'terms.html' },
    { path: '/privacy', file: 'privacy.html' },
    { path: '/download', file: 'download.html' },
    { path: '/download/windows', file: 'download/windows.html' }
  ];

  for (const { path: routePath, file } of routesToPrerender) {
    console.log(`Prerendering route: ${routePath} ...`);
    const helmetContext = {};
    const appHtml = render(routePath, helmetContext);

    let headInject = '';
    let cleanedAppHtml = appHtml;

    // 1. Extract <title>...</title>
    const titleRegex = /<title>[^]*?<\/title>/;
    const titleMatch = appHtml.match(titleRegex);
    if (titleMatch) {
      headInject += titleMatch[0] + '\n';
      cleanedAppHtml = cleanedAppHtml.replace(titleRegex, '');
    }

    // 2. Extract <meta ... /> tags (like name, property tags)
    const metaRegex = /<meta[^>]*?\/>/g;
    const metaMatches = appHtml.match(metaRegex);
    if (metaMatches) {
      for (const metaMatch of metaMatches) {
        if (metaMatch.includes('name=') || metaMatch.includes('property=')) {
          headInject += metaMatch + '\n';
          cleanedAppHtml = cleanedAppHtml.replace(metaMatch, '');
        }
      }
    }

    // 3. Extract <link rel="canonical" ... /> and preload links
    const linkRegex = /<link[^>]*?\/>/g;
    const linkMatches = appHtml.match(linkRegex);
    if (linkMatches) {
      for (const linkMatch of linkMatches) {
        if (linkMatch.includes('rel="canonical"') || linkMatch.includes('rel="preload"')) {
          headInject += linkMatch + '\n';
          cleanedAppHtml = cleanedAppHtml.replace(linkMatch, '');
        }
      }
    }

    // Replace the placeholders in the index.html template
    let html = template.replace('<div id="root"></div>', `<div id="root">${cleanedAppHtml}</div>`);

    if (headInject.trim()) {
      // Inject tags right before </head>
      html = html.replace('</head>', `${headInject}</head>`);
    }

    const filePath = toAbsolute(`dist/${file}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html);
    console.log(`Successfully generated static page: ${filePath}`);
  }

  // Clean up the temporary dist-server directory
  console.log('Cleaning up temporary server build directory...');
  fs.rmSync(toAbsolute('dist-server'), { recursive: true, force: true });
  console.log('Prerendering completed successfully!');
}

prerender().catch((err) => {
  console.error('Error during prerendering:', err);
  process.exit(1);
});
