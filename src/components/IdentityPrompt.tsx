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
              const isGoogleUser = member.authProvider === "google";
              const button = (
                <Button
                  key={member.id}
                  variant={isGoogleUser ? "outline" : "primaryDark"}
                  className="w-full flex justify-between items-center"
                  disabled={isGoogleUser}
                  onClick={() => onSelect(member)}
                >
                  <span>{member.firstName}</span>
                  {isGoogleUser && (
                    <Badge variant="secondary" className="text-xs">
                      Google user
                    </Badge>
                  )}
                </Button>
              );

              return isGoogleUser ? (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>
                    <p>Sign in with Google to use this account</p>
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
