import { createRoot } from 'react-dom/client'
import AppWrapper from './App.tsx'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <AppWrapper />
  </TooltipProvider>
);
