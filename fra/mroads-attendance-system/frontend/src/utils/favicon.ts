/**
 * Favicon utility for handling light/dark mode favicon switching
 */

export const updateFavicon = (isDarkMode: boolean): void => {
  const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (favicon) {
    favicon.href = isDarkMode ? '/favicon-dark.png' : '/favicon-light.png';
  }
};

export const initializeFavicon = (): void => {
  // Check system preference or stored theme
  const isDarkMode = 
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  updateFavicon(isDarkMode);
  
  // Listen for theme changes
  const observer = new MutationObserver(() => {
    const hasDarkClass = document.documentElement.classList.contains('dark');
    updateFavicon(hasDarkClass);
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Also listen for storage changes (in case theme is changed in another tab)
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') {
      const isDark = e.newValue === 'dark';
      updateFavicon(isDark);
    }
  });
};
