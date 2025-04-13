import { Member } from "@/types/group";
import { Button } from "@/components/ui/button";

interface IdentityPromptProps {
  members: Member[];
  onSelect: (member: Member) => void;
}

export default function IdentityPrompt({ members, onSelect }: IdentityPromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="font-bold mb-4 text-center text-lg">Who are you?</h2>
        <div className="space-y-2">
          {members.map((member) => (
            <Button
              key={member.userId}
              className="w-full"
              onClick={() => onSelect(member)}
            >
              {member.firstName}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
