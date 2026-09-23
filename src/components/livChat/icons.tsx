import type { CSSProperties } from 'react'

// ── Minimal inline icon set (stroke glyphs, inherit currentColor) ────────────
const ic: CSSProperties = { width: 14, height: 14, display: 'inline-block', verticalAlign: '-2px' }
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: ic, 'aria-hidden': true }
export const MicI = () => <svg {...svg}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
export const SpeakerI = () => <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
export const KeyboardI = () => <svg {...svg}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="13" x2="18" y2="13" /><line x1="6" y1="9" x2="6.01" y2="9" /><line x1="18" y1="9" x2="18.01" y2="9" /></svg>
export const PhoneI = () => <svg {...svg}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
export const SmartphoneI = () => <svg {...svg}><rect x="7" y="2" width="10" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
export const MessageI = () => <svg {...svg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
export const ImageI = () => <svg {...svg}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
export const SearchI = () => <svg {...svg}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
export const ChevronDownI = () => <svg {...svg}><path d="M6 9l6 6 6-6" /></svg>
export const CloseI = () => <svg {...svg}><path d="M18 6L6 18M6 6l12 12" /></svg>
export const Maximize2I = () => <svg {...svg}><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
export const Minimize2I = () => <svg {...svg}><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
export const PlusI = () => <svg {...svg}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
export const ArrowUpI = () => <svg {...svg}><line x1="12" y1="19" x2="12" y2="5" /><path d="M5 12l7-7 7 7" /></svg>
export const GlobeI = () => <svg {...svg}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
export const ToolI = () => <svg {...svg}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18l3 3 6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></svg>
export const PencilI = () => <svg {...svg}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
export const TrashI = () => <svg {...svg}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
export const CopyI = () => <svg {...svg}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
export const CheckI = () => <svg {...svg}><polyline points="20 6 9 17 4 12" /></svg>
// Read-aloud controls (accessibility: per-message Play/Stop, top-left of the response frame).
export const PlayI = () => <svg {...svg}><polygon points="6 3 20 12 6 21 6 3" /></svg>
export const StopSmallI = () => <svg {...svg}><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
export const MenuI = () => <svg {...svg}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
export const DownloadI = () => <svg {...svg}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
export const FileTextI = () => <svg {...svg}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
export const ShieldI = () => <svg {...svg}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
export const CodeI = () => <svg {...svg}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
export const ExternalLinkI = () => <svg {...svg}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
export const ListChecksI = () => <svg {...svg}><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></svg>
