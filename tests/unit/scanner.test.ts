// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const scan = vi.hoisted(() => ({ callback: undefined as undefined | ((result: {getText: () => string}) => void), stop: vi.fn() }));
vi.mock('@zxing/browser', () => ({ BrowserQRCodeReader: class { static releaseAllStreams() {} async decodeFromConstraints(_options: unknown, _video: unknown, callback: typeof scan.callback) { scan.callback=callback; return {stop:scan.stop}; } } }));
import { QrScanner } from '@/components/scanner/qr-scanner';
afterEach(() => { cleanup(); scan.callback=undefined; vi.clearAllMocks(); });
it('uses the current borrower callback after props change while camera stays on', async () => {
 const old=vi.fn(); const current=vi.fn(); const view=render(createElement(QrScanner,{expected:'tool',onScan:old}));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Start rear camera'}));});
 view.rerender(createElement(QrScanner,{expected:'tool',onScan:current}));
 await act(async()=>{scan.callback?.({getText:()=> 'NEW-001'});});
 expect(old).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledWith('NEW-001');
});
it('ignores scans while processing or disabled and after the camera unmounts', async () => {
 let resolve!:()=>void; const onScan=vi.fn(()=>new Promise<void>(r=>{resolve=r;}));
 const view=render(createElement(QrScanner,{expected:'tool',onScan}));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Start rear camera'}));});
 await act(async()=>{scan.callback?.({getText:()=> 'A-001'}); scan.callback?.({getText:()=> 'A-002'});});
 expect(onScan).toHaveBeenCalledTimes(1);
 await act(async()=>{resolve();});
 view.rerender(createElement(QrScanner,{expected:'tool',onScan,disabled:true}));
 await act(async()=>{scan.callback?.({getText:()=> 'A-003'});}); expect(onScan).toHaveBeenCalledTimes(1);
 const delayed=scan.callback; view.unmount(); delayed?.({getText:()=> 'A-004'}); expect(onScan).toHaveBeenCalledTimes(1); expect(scan.stop).toHaveBeenCalledOnce();
});
