import { NextRequest, NextResponse } from 'next/server';
import { updateExpense, deleteExpense, fetchGroupById } from '@/lib/firebaseUtils';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const { groupId, expenseId } = await params;
    const body = await request.json();
    const { description, amount, paidBy, splits, createdAt } = body;

    // Validate required fields
    if (!description || !amount || !paidBy || !splits) {
      return NextResponse.json(
        { error: 'Description, amount, paidBy, and splits are required' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate splits add up to 100%
    const totalSplit = Object.values(splits).reduce((sum: number, split: unknown) => sum + (split as number), 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Splits must add up to 100%' },
        { status: 400 }
      );
    }

    // Fetch group to validate it exists
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Convert to minor units (cents)
    const amountMinor = Math.round(expenseAmount * 100);
    const splitsMinor: Record<string, number> = {};
    for (const [memberId, split] of Object.entries(splits)) {
      splitsMinor[memberId] = Math.round(parseFloat(split as string) * expenseAmount * 100 / 100);
    }

    // Create expense date
    const expenseDate = createdAt ? new Date(createdAt) : new Date();

    // Update expense in Firebase
    await updateExpense(groupId, expenseId, {
      description,
      amount: expenseAmount,
      paidBy,
      splits,
      createdAt: expenseDate,
      amountMinor,
      splitsMinor
    });

    // Return success response
    return NextResponse.json({
      success: true,
      expenseId,
      expense: {
        id: expenseId,
        description,
        amount: expenseAmount,
        paidBy,
        splits,
        createdAt: expenseDate.toISOString(),
        currency: group.currency
      },
      message: `Expense "${description}" updated successfully`
    });

  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const { groupId, expenseId } = await params;

    // Fetch group to validate it exists
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Delete expense from Firebase
    await deleteExpense(groupId, expenseId);

    // Return success response
    return NextResponse.json({
      success: true,
      expenseId,
      message: `Expense ${expenseId} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}


