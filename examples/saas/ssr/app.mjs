import React from 'react';

function Nav({ href, label }) {
  return React.createElement('a', { href, style: { marginRight: 12 } }, label);
}

export default function App({ path }) {
  return React.createElement(
    'div',
    { style: { fontFamily: 'system-ui, sans-serif', padding: 24 } },
    React.createElement(
      'header',
      null,
      React.createElement('h1', { style: { margin: 0 } }, 'JORVEL SaaS'),
      React.createElement(
        'p',
        { style: { marginTop: 6, opacity: 0.8 } },
        'SSR/SSG demo export — current route: ',
        React.createElement('code', null, path)
      ),
      React.createElement(
        'nav',
        { style: { marginTop: 12 } },
        React.createElement(Nav, { href: '/', label: 'Home' }),
        React.createElement(Nav, { href: '/pricing', label: 'Pricing' }),
        React.createElement(Nav, { href: '/app', label: 'App' }),
        React.createElement(Nav, { href: '/app/settings', label: 'Settings' })
      )
    ),
    React.createElement('hr', { style: { margin: '18px 0' } }),
    path === '/'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-home' },
          React.createElement('h2', null, 'Marketing'),
          React.createElement('p', null, 'Landing page content. Great for SSG.')
        )
      : null,
    path === '/pricing'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-pricing' },
          React.createElement('h2', null, 'Pricing'),
          React.createElement(
            'ul',
            null,
            React.createElement('li', null, 'Starter'),
            React.createElement('li', null, 'Pro'),
            React.createElement('li', null, 'Enterprise')
          )
        )
      : null,
    path === '/app'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-app' },
          React.createElement('h2', null, 'App shell'),
          React.createElement('p', null, "This would normally require auth; here it's just a page.")
        )
      : null,
    path === '/app/settings'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-settings' },
          React.createElement('h2', null, 'Settings'),
          React.createElement('p', null, 'Preferences, profile, billing, etc.')
        )
      : null
  );
}
