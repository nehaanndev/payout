import { Member } from "@/types/group";
import { Label } from '@/components/ui/label';
import { Trash2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface GroupDetailsFormProps {
    groupName: string;
    setGroupName: (v: string) => void;
    members: Member[];
    addMember: (name: string, email?: string) => void;
    removeMember: (firstName: string) => void;
    canContinue: boolean;
    onNext: () => void;
  }
  
  export default function GroupDetailsForm({
    groupName,
    setGroupName,
    members,
    addMember,
    removeMember,
    canContinue,
    onNext,
  }: GroupDetailsFormProps) {
    /* local state for the “Add member” inputs */
    const [first, setFirst] = useState('');
    const [email, setEmail] = useState('');
  
    return (
      <Card>
        <CardHeader><CardTitle>Group details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Group name</Label>
            <Input value={groupName} onChange={e => setGroupName(e.target.value)} />
          </div>
  
          <div className="flex gap-2">
            <Input
              placeholder="First name"
              value={first}
              onChange={e => setFirst(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember(first, email)}
            />
            <Input
              placeholder="Email (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMember(first, email)}
            />
            <Button
              variant="primaryDark"
              disabled={!first}
              onClick={() => {
                addMember(first, email);
                setFirst(''); setEmail('');
              }}
            >
              Add
            </Button>
          </div>
  
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <div key={m.id} className="bg-slate-100 rounded px-2 py-1 flex items-center gap-1">
                {m.firstName}
                <Trash2 className="w-4 h-4 cursor-pointer" onClick={() => removeMember(m.firstName)} />
              </div>
            ))}
          </div>
  
          <Button variant="primaryDark" disabled={!canContinue} onClick={onNext}>
            Next
          </Button>
        </CardContent>
      </Card>
    );
  }
  