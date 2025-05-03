import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter
  } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settlement } from '@/types/settlement';
import { Group, Member } from '@/types/group';
import { useState } from 'react';
  
  interface Props {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    rawBalances: Record<string, number>;
    onSave: (payerId: string, payeeId: string, amount: number, date: Date) => Promise<void>;
  }
  
  export default function SettlementModal({
    isOpen, onClose, group, rawBalances, onSave
  }: Props) {
    const payers = group.members.filter(m => rawBalances[m.id] > 0);
    const payees = group.members.filter(m => rawBalances[m.id] < 0);
    const [payer, setPayer] = useState(payers[0]?.id ?? '');
    const [payee, setPayee] = useState(payees[0]?.id ?? '');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
    const save = async () => {
      await onSave(payer, payee, parseFloat(amount), new Date(date));
      onClose();
    };
  
    return (
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Debts in “{group.name}”</DialogTitle>
          </DialogHeader>
  
          <div className="space-y-4">
            <div>
              <Label>Payer</Label>
              <Select value={payer} onValueChange={setPayer}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payer" />
            </SelectTrigger>
            <SelectContent>
              {payers.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            </div>
            <div>
              <Label>Payee</Label>
              <Select value={payee} onValueChange={setPayee}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payee" />
            </SelectTrigger>
            <SelectContent>
              {payees.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
  
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={!amount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  