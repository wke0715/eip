import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { CancelBookingButton } from "./cancel-booking-button";

export default async function MeetingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bookings = await prisma.meetingBooking.findMany({
    where: {
      date: { gte: today },
      isCancelled: false,
    },
    include: {
      room: { select: { name: true } },
      booker: { select: { name: true, email: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">會議室</h1>
        <Link href="/dashboard/meeting/book" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          預約會議室
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">即將到來的會議</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              目前沒有會議預約
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>會議室</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>時段</TableHead>
                  <TableHead>主題</TableHead>
                  <TableHead>預約人</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.room.name}</TableCell>
                    <TableCell>
                      {new Date(b.date).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell>
                      {b.startTime} - {b.endTime}
                    </TableCell>
                    <TableCell>{b.subject}</TableCell>
                    <TableCell>
                      {b.booker.name ?? b.booker.email}
                    </TableCell>
                    <TableCell>
                      {b.bookerId === session.user.id && (
                        <CancelBookingButton bookingId={b.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
