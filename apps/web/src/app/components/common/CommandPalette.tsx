"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Plus,
  UserPlus,
  Building,
  Pause,
  Bot,
  ListTodo,
  FileText,
  Loader2,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "../ui/command";
import { getAgents, getTasks } from "../../../lib/api";
import { useCompany } from "../../../contexts/CompanyContext";
import type { Agent, Task } from "@buildcrew/shared";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pages = [
  { label: "Overview", route: "/overview" },
  { label: "Agents", route: "/agents" },
  { label: "Tasks", route: "/tasks" },
  { label: "Budget", route: "/budget" },
  { label: "Knowledge", route: "/knowledge" },
  { label: "Guardian", route: "/guardian" },
  { label: "Plugins", route: "/plugins" },
  { label: "Smart Router", route: "/smart-router" },
  { label: "Evolution", route: "/evolution" },
  { label: "Group Dashboard", route: "/group" },
  { label: "Settings", route: "/settings" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentCompanyId } = useCompany();
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const quickActions = [
    { id: "create-task", label: t('commandPalette.actions.createTask', 'Create New Task'), icon: Plus, route: "/tasks" },
    {
      id: "hire-agent",
      label: t('commandPalette.actions.hireAgent', 'Hire New Agent'),
      icon: UserPlus,
      route: "/agents",
    },
    {
      id: "switch-company",
      label: t('commandPalette.actions.switchCompany', 'Switch Company'),
      icon: Building,
      route: "/overview",
    },
    {
      id: "pause-all",
      label: t('commandPalette.actions.pauseAll', 'Pause All Agents'),
      icon: Pause,
      route: "/guardian",
    },
  ] as const;

  // Fetch agents and tasks when palette opens
  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(true);
      Promise.all([
        getAgents(currentCompanyId).catch((err) => { console.error('CommandPalette: failed to fetch agents:', err); return [] as Agent[]; }),
        getTasks(currentCompanyId).catch((err) => { console.error('CommandPalette: failed to fetch tasks:', err); return [] as Task[]; }),
      ]).then(([agentData, taskData]) => {
        setAgents(agentData);
        setTasks(taskData);
      }).finally(() => setLoading(false));
    }
    if (!open) {
      setSearch("");
      fetchedRef.current = false;
    }
  }, [open, currentCompanyId]);

  const handleSelect = useCallback(
    (route: string) => {
      onOpenChange(false);
      navigate(route);
    },
    [navigate, onOpenChange],
  );

  const hasSearch = search.length > 0;

  // Filter agents by name or title
  const filteredAgents = hasSearch
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.title.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  // Filter tasks by title
  const filteredTasks = hasSearch
    ? tasks.filter((task) =>
        task.title.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  // Filter pages by label
  const filteredPages = hasSearch
    ? pages.filter((p) =>
        p.label.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div data-testid="command-palette">
        <CommandInput
          data-testid="command-input"
          placeholder={t('commandPalette.placeholder')}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>{t('commandPalette.noResults', 'No results found.')}</CommandEmpty>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasSearch && !loading && (
            <>
              <CommandGroup heading={t('commandPalette.quickActions', 'Quick Actions')}>
                {quickActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={action.label}
                    onSelect={() => handleSelect(action.route)}
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    <span>{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasSearch && filteredAgents.length > 0 && (
            <CommandGroup heading={t('commandPalette.agents', 'Agents')}>
              {filteredAgents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`agent-${agent.name}`}
                  onSelect={() => handleSelect("/agents")}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  <span>{agent.name}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {agent.title}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {hasSearch && filteredTasks.length > 0 && (
            <>
              {filteredAgents.length > 0 && <CommandSeparator />}
              <CommandGroup heading={t('commandPalette.tasks', 'Tasks')}>
                {filteredTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.title}`}
                    onSelect={() => handleSelect("/tasks")}
                  >
                    <ListTodo className="mr-2 h-4 w-4" />
                    <span>{task.title}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {task.status}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {hasSearch && filteredPages.length > 0 && (
            <>
              {(filteredAgents.length > 0 || filteredTasks.length > 0) && (
                <CommandSeparator />
              )}
              <CommandGroup heading={t('commandPalette.pages', 'Pages')}>
                {filteredPages.map((page) => (
                  <CommandItem
                    key={page.route}
                    value={`page-${page.label}`}
                    onSelect={() => handleSelect(page.route)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>{page.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {page.route}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
