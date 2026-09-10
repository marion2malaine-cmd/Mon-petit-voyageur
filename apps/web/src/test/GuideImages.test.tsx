import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GuideImages from '../GuideImages';
import { api } from '../api';
vi.mock('../api', () => ({ api: { getGuideImages: vi.fn(), saveGuideImages: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); });
it('explains how to paste the actual image when only a link was copied', async () => {
  vi.mocked(api.getGuideImages).mockResolvedValue([]);
  render(<GuideImages tripId={7}/>);
  await waitFor(() => expect(screen.getByText('Coller une image')).toBeEnabled());
  fireEvent.paste(screen.getByRole('group', { name: 'Zone de collage des images' }), { clipboardData: { files: [] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Copier l’image');
  expect(api.saveGuideImages).not.toHaveBeenCalled();
});
it('removes a saved image from the correct trip', async () => {
  vi.mocked(api.getGuideImages).mockResolvedValue([{ image: 'data:image/jpeg;base64,/9j/2Q==', title: 'Paris' }]);
  vi.mocked(api.saveGuideImages).mockResolvedValue([]);
  render(<GuideImages tripId={8}/>);
  fireEvent.click(await screen.findByText('Retirer'));
  await waitFor(() => expect(api.saveGuideImages).toHaveBeenCalledWith(8, []));
  expect(await screen.findByText('Image retirée du guide.')).toBeInTheDocument();
});
