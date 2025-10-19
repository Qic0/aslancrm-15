import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Briefcase, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { WorkerDetailsDialog } from "@/components/WorkerDetailsDialog";
import { supabase } from "@/integrations/supabase/client";

interface DispatcherProfileProps {
  user: {
    uuid_user: string;
    full_name: string;
    email: string;
    role: string;
    avatar_url?: string;
  };
  isOnline: boolean;
}

const DispatcherProfile = ({ user, isOnline }: DispatcherProfileProps) => {
  const { signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [workerData, setWorkerData] = useState<any>(null);

  const handleProfileClick = async () => {
    // Fetch full worker data including completed_tasks
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('uuid_user', user.uuid_user)
      .single();
    
    setWorkerData(data);
    setProfileOpen(true);
  };

  const roleLabels: Record<string, string> = {
    dispatcher: 'Диспетчер',
    admin: 'Администратор'
  };

  return (
    <>
      <Card 
        className="border-2 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleProfileClick}
      >
        <CardContent className="p-6 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-9 w-9"
          onClick={(e) => {
            e.stopPropagation();
            signOut();
          }}
        >
          <LogOut className="h-5 w-5" />
        </Button>
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatar_url} alt={user.full_name} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display font-semibold">
                {user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-background ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>

          <div className="space-y-2 w-full">
            <h3 className="font-display font-bold text-xl">{user.full_name}</h3>
            
            <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
              {roleLabels[user.role] || user.role}
            </Badge>
          </div>

          <div className="w-full space-y-3 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{user.email}</span>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Проверка задач</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                {isOnline ? 'Онлайн' : 'Офлайн'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    
    {workerData && (
      <WorkerDetailsDialog 
        worker={workerData}
        open={profileOpen} 
        onOpenChange={setProfileOpen} 
      />
    )}
    </>
  );
};

export default DispatcherProfile;
