import { Member } from "@/types/group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IdentityPromptProps {
  members: Member[];
  onSelect: (member: Member) => void;
}

export default function IdentityPrompt({ members, onSelect }: IdentityPromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="font-bold mb-4 text-center text-lg">Who are you?</h2>

        <TooltipProvider>
          <div className="space-y-2">
            {members.map((member) => {
              const isManagedUser =
                member.authProvider === "google" || member.authProvider === "microsoft";
              const providerLabel =
                member.authProvider === "google"
                  ? "Google user"
                  : member.authProvider === "microsoft"
                  ? "Microsoft user"
                  : null;
              const button = (
                <Button
                  key={member.id}
                  variant={isManagedUser ? "outline" : "primaryDark"}
                  className="w-full flex justify-between items-center"
                  disabled={isManagedUser}
                  onClick={() => onSelect(member)}
                >
                  <span>{member.firstName}</span>
                  {providerLabel && (
                    <Badge variant="secondary" className="text-xs">
                      {providerLabel}
                    </Badge>
                  )}
                </Button>
              );

              return isManagedUser ? (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {member.authProvider === "google"
                        ? "Sign in with Google to use this account"
                        : "Sign in with Microsoft to use this account"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
