import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import { BRAND_NAME } from '../../config/brand';

function renderFooter(props?: { reserveMobileNavSpace?: boolean }) {
  return render(
    <MemoryRouter>
      <Footer {...props} />
    </MemoryRouter>,
  );
}

describe('Footer', () => {
  it('renders Arden logo, tagline, legal links, and copyright', () => {
    renderFooter();

    expect(screen.getByRole('img', { name: `${BRAND_NAME} logo` })).toBeInTheDocument();
    expect(screen.getByText('Built for construction professionals.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
    expect(screen.getByText(new RegExp(`© \\d{4} ${BRAND_NAME}\\. All rights reserved\\.`))).toBeInTheDocument();
  });

  it('reserves space above mobile bottom nav when requested', () => {
    const { container } = renderFooter({ reserveMobileNavSpace: true });
    expect(container.querySelector('footer')).toHaveClass('mb-16', 'md:mb-0');
  });
});
