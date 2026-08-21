import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SiteFooter } from './SiteFooter';

it('offers compact product and contribution paths', () => {
  render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );

  expect(screen.getByRole('contentinfo')).toHaveTextContent('Less scrolling. More going.');
  expect(screen.getByRole('link', { name: 'Suggest a source' })).toHaveAttribute(
    'href',
    expect.stringContaining('source-suggestion.yml'),
  );
  expect(screen.getByText(/fresh facts · official links/i)).toBeVisible();
});
