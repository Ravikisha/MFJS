import React from 'react';

function Nav({ href, label }) {
  return React.createElement('a', { href, style: { marginRight: 12 } }, label);
}

export default function App({ path, params }) {
  const sku = params?.sku;

  return React.createElement(
    'div',
    { style: { fontFamily: 'system-ui, sans-serif', padding: 24 } },
    React.createElement(
      'header',
      null,
      React.createElement('h1', { style: { margin: 0 } }, 'JORVEL E-commerce'),
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
        React.createElement(Nav, { href: '/products', label: 'Products' }),
        React.createElement(Nav, { href: '/products/sku-123', label: 'Product sku-123' }),
        React.createElement(Nav, { href: '/cart', label: 'Cart' })
      )
    ),
    React.createElement('hr', { style: { margin: '18px 0' } }),
    path === '/'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-home' },
          React.createElement('h2', null, 'Welcome'),
          React.createElement('p', null, 'This is a minimal static-exportable storefront shell.')
        )
      : null,
    path === '/products'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-products' },
          React.createElement('h2', null, 'Products'),
          React.createElement(
            'ul',
            null,
            React.createElement(
              'li',
              null,
              React.createElement('a', { href: '/products/sku-123' }, 'sku-123')
            )
          )
        )
      : null,
    String(path).startsWith('/products/')
      ? React.createElement(
          'section',
          { 'data-testid': 'page-product' },
          React.createElement('h2', null, 'Product details'),
          React.createElement(
            'div',
            null,
            'SKU: ',
            React.createElement(
              'strong',
              { 'data-testid': 'product-sku' },
              sku ?? String(path).split('/').pop()
            )
          )
        )
      : null,
    path === '/cart'
      ? React.createElement(
          'section',
          { 'data-testid': 'page-cart' },
          React.createElement('h2', null, 'Cart'),
          React.createElement('p', null, 'Your cart is empty.')
        )
      : null
  );
}
