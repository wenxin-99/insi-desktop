import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
import { ColorsSection } from "./showcase/ColorsSection";
import { ButtonsSection } from "./showcase/ButtonsSection";
import { FormInputsSection } from "./showcase/FormInputsSection";
import { DataDisplaySection } from "./showcase/DataDisplaySection";
import { AlertsTabsSection } from "./showcase/AlertsTabsSection";
import { DialogMenusSection } from "./showcase/DialogMenusSection";
import { MiscSection } from "./showcase/MiscSection";
import { AIChatSection } from "./showcase/AIChatSection";

} from "@/components/ui/menubar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertCircle,
  CalendarIcon,
  Check,
  Clock,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast as sonnerToast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";

export default function ComponentsShowcase() {
  const { theme, toggleTheme } = useTheme();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [datePickerDate, setDatePickerDate] = useState<Date>();
  const [selectedFruits, setSelectedFruits] = useState<string[]>([]);
  const [progress, setProgress] = useState(33);
  const [currentPage, setCurrentPage] = useState(2);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dialogInput, setDialogInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // AI ChatBox demo state
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleDialogSubmit = () => {
    console.log("Dialog submitted with value:", dialogInput);
    sonnerToast.success("Submitted successfully", {
      description: `Input: ${dialogInput}`,
    });
    setDialogInput("");
    setDialogOpen(false);
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleDialogSubmit();
    }
  };

  const handleChatSend = (content: string) => {
    // Add user message
    const newMessages: Message[] = [...chatMessages, { role: "user", content }];
    setChatMessages(newMessages);

    // Simulate AI response with delay
    setIsChatLoading(true);
    setTimeout(() => {
      const aiResponse: Message = {
        role: "assistant",
        content: `This is a **demo response**. In a real app, you would call a tRPC mutation here:\n\n\`\`\`typescript\nconst chatMutation = trpc.ai.chat.useMutation({\n  onSuccess: (response) => {\n    setChatMessages(prev => [...prev, {\n      role: "assistant",\n      content: response.choices[0].message.content\n    }]);\n  }\n});\n\nchatMutation.mutate({ messages: newMessages });\n\`\`\`\n\nYour message was: "${content}"`,
      };
      setChatMessages([...newMessages, aiResponse]);
      setIsChatLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container max-w-6xl mx-auto">
        <div className="space-y-2 justify-between flex">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Shadcn/ui Component Library
          </h2>
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="space-y-12">

      <ColorsSection />
      <ButtonsSection />
      <FormInputsSection />
      <DataDisplaySection />
      <AlertsTabsSection />
      <DialogMenusSection />
      <MiscSection />
      <AIChatSection />
        </div>
      </footer>
    </div>
  );
}