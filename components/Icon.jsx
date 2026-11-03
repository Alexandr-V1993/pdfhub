import {
  ClipboardList, Code, Combine, Crop, Droplets, EyeOff, File, FileCheck, FileCode, FileDown, FileImage,
  FileOutput, FileText, GitCompare, Image, Languages, LayoutGrid, ListOrdered, Lock, PenTool, Pencil,
  Presentation, RotateCw, Film, Music, Table, BookOpen, ScanLine, ScanText, Scissors, Sheet, Sparkles, Trash2, Unlock, Wrench,
} from 'lucide-react';

// Явный список вместо `import *`, чтобы в сборку попали только нужные иконки
const ICONS = {
  Film, Music, Table, BookOpen, ClipboardList, Code, Combine, Crop, Droplets, EyeOff, FileCheck, FileCode, FileDown, FileImage,
  FileOutput, FileText, GitCompare, Image, Languages, LayoutGrid, ListOrdered, Lock, PenTool, Pencil,
  Presentation, RotateCw, ScanLine, ScanText, Scissors, Sheet, Sparkles, Trash2, Unlock, Wrench,
};

export default function Icon({ name, size = 20 }) {
  const C = ICONS[name] || File;
  return <C size={size} strokeWidth={1.8} aria-hidden="true" />;
}
