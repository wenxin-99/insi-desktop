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

export function FormInputsSection() {
  return (
    <>
          {/* Form Inputs Section */}
          <section className="space-y-4">
            <h3 className="text-2xl font-semibold">Form Inputs</h3>
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Type your message here."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a fruit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apple">Apple</SelectItem>
                      <SelectItem value="banana">Banana</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="terms" />
                  <Label htmlFor="terms">Accept terms and conditions</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="airplane-mode" />
                  <Label htmlFor="airplane-mode">Airplane Mode</Label>
                </div>
                <div className="space-y-2">
                  <Label>Radio Group</Label>
                  <RadioGroup defaultValue="option-one">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option-one" id="option-one" />
                      <Label htmlFor="option-one">Option One</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="option-two" id="option-two" />
                      <Label htmlFor="option-two">Option Two</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Slider</Label>
                  <Slider defaultValue={[50]} max={100} step={1} />
                </div>
                <div className="space-y-2">
                  <Label>Input OTP</Label>
                  <InputOTP maxLength={6}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="space-y-2">
                  <Label>Date Time Picker</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          !datePickerDate && "text-muted-foreground"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {datePickerDate ? (
                          format(datePickerDate, "PPP HH:mm", { locale: zhCN })
                        ) : (
                          <span>Select date and time</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 space-y-3">
                        <Calendar
                          mode="single"
                          selected={datePickerDate}
                          onSelect={setDatePickerDate}
                        />
                        <div className="border-t pt-3 space-y-2">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Time
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              type="time"
                              value={
                                datePickerDate
                                  ? format(datePickerDate, "HH:mm")
                                  : "00:00"
                              }
                              onChange={e => {
                                const [hours, minutes] =
                                  e.target.value.split(":");
                                const newDate = datePickerDate
                                  ? new Date(datePickerDate)
                                  : new Date();
                                newDate.setHours(parseInt(hours));
                                newDate.setMinutes(parseInt(minutes));
                                setDatePickerDate(newDate);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  {datePickerDate && (
                    <p className="text-sm text-muted-foreground">
                      Selected:{" "}
                      {format(datePickerDate, "yyyy/MM/dd  HH:mm", {
                        locale: zhCN,
                      })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Searchable Dropdown</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between"
                      >
                        {selectedFramework
                          ? [
                              { value: "react", label: "React" },
                              { value: "vue", label: "Vue" },
                              { value: "angular", label: "Angular" },
                              { value: "svelte", label: "Svelte" },
                              { value: "nextjs", label: "Next.js" },
                              { value: "nuxt", label: "Nuxt" },
                              { value: "remix", label: "Remix" },
                            ].find(fw => fw.value === selectedFramework)?.label
                          : "Select framework..."}
                        <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search frameworks..." />
                        <CommandList>
                          <CommandEmpty>No framework found</CommandEmpty>
                          <CommandGroup>
                            {[
                              { value: "react", label: "React" },
                              { value: "vue", label: "Vue" },
                              { value: "angular", label: "Angular" },
                              { value: "svelte", label: "Svelte" },
                              { value: "nextjs", label: "Next.js" },
                              { value: "nuxt", label: "Nuxt" },
                              { value: "remix", label: "Remix" },
                            ].map(framework => (
                              <CommandItem
                                key={framework.value}
                                value={framework.value}
                                onSelect={currentValue => {
                                  setSelectedFramework(
                                    currentValue === selectedFramework
                                      ? ""
                                      : currentValue
                                  );
                                  setOpenCombobox(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedFramework === framework.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                {framework.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedFramework && (
                    <p className="text-sm text-muted-foreground">
                      Selected:{" "}
                      {
                        [
                          { value: "react", label: "React" },
                          { value: "vue", label: "Vue" },
                          { value: "angular", label: "Angular" },
                          { value: "svelte", label: "Svelte" },
                          { value: "nextjs", label: "Next.js" },
                          { value: "nuxt", label: "Nuxt" },
                          { value: "remix", label: "Remix" },
                        ].find(fw => fw.value === selectedFramework)?.label
                      }
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="month" className="text-sm font-medium">
                        Month
                      </Label>
                      <Select
                        value={selectedMonth}
                        onValueChange={setSelectedMonth}
                      >
                        <SelectTrigger id="month">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            month => (
                              <SelectItem
                                key={month}
                                value={month.toString().padStart(2, "0")}
                              >
                                {month.toString().padStart(2, "0")}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year" className="text-sm font-medium">
                        Year
                      </Label>
                      <Select
                        value={selectedYear}
                        onValueChange={setSelectedYear}
                      >
                        <SelectTrigger id="year">
                          <SelectValue placeholder="YYYY" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: 10 },
                            (_, i) => new Date().getFullYear() - 5 + i
                          ).map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedMonth && selectedYear && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedYear}/{selectedMonth}/
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

    </>
  );
}
