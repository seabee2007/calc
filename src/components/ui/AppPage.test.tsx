import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppPage from './AppPage';
import PageHeader from './PageHeader';
import { PAGE_GUTTER, PAGE_MAX_WIDTH } from '../../theme/appTheme';

describe('AppPage', () => {
  it('wraps header and content in one shared gutter container', () => {
    render(
      <AppPage
        data-testid="app-page"
        header={<PageHeader title="Proposal Pipeline" subtitle="CRM-style pipeline" />}
      >
        <div data-testid="page-body">Body</div>
      </AppPage>,
    );

    const page = screen.getByTestId('app-page');
    expect(page.className).toContain(PAGE_MAX_WIDTH);

    const gutter = page.firstElementChild;
    expect(gutter?.className).toContain(PAGE_GUTTER);
    expect(gutter).toContainElement(screen.getByRole('heading', { name: 'Proposal Pipeline' }));
    expect(gutter).toContainElement(screen.getByTestId('page-body'));
  });
});
