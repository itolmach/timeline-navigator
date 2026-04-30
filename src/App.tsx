import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import ExperimentView from "./pages/ExperimentView.tsx";
import OriginalView from "./pages/OriginalView.tsx";
import SequenceView from "./pages/SequenceView.tsx";
import CompactView from "./pages/CompactView.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/experiment" element={<ExperimentView />} />
          <Route path="/original" element={<OriginalView />} />
          <Route path="/sequence" element={<SequenceView />} />
          <Route path="/compact" element={<CompactView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
