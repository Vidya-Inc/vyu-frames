import './globals.css';

export const metadata = {
  title: 'vyu.frames',
  description: 'Photography portfolio',
};

// Applies the saved theme before first paint so a dark-returning visitor never
// sees a flash of the default palette. Kept in sync with lib/themes.js.
const themeBootstrap = `try{var t=localStorage.getItem('vf-theme');if(t){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
