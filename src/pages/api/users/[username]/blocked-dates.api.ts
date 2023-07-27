/* eslint-disable camelcase */
import { prisma } from '@/src/lib/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).end()
  }

  const username = String(req.query.username)
  const { year, month } = req.query

  if (!year || !month) {
    return res.status(404).json({ message: 'Year or Month not specified.' })
  }

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  })

  if (!user) {
    return res.status(404).json({ message: 'User does not exit.' })
  }

  const availableWeekDays = await prisma.userTimeInterval.findMany({
    select: {
      week_day: true,
    },
    where: {
      user_id: user.id,
    },
  })

  const blockedWeekDays = [0, 1, 2, 3, 4, 5, 6].filter((weekDay) => {
    return !availableWeekDays.some(
      (availableWeekDays) => availableWeekDays.week_day === weekDay,
    )
  })

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`

  const blockedDatesRaw: Array<{ date: number }> = await prisma.$queryRaw`
    SELECT 
      EXTRACT(DAY FROM S.date) AS date,
      COUNT (S.date) AS amount,
      ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60) AS size

    FROM schedulings S

    LEFT JOIN user_time_intervals UTI
      ON UTI.week_day = TO_NUMBER(TO_CHAR(S.DATE, 'ID'), '99')

    WHERE S.user_id = ${user.id}
      AND TO_CHAR(S.date, 'YYYY-MM') = ${yearMonth}
    
    GROUP BY EXTRACT(DAY FROM S.date), 
      (UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60

    HAVING (COUNT (S.date)) >= ((UTI.time_end_in_minutes - UTI.time_start_in_minutes) / 60)
  `
  // in MYSQL: DATE_FORMAT(S.date, "%Y-%m") = ${`${year}-${month}`}

  const blockedDates = blockedDatesRaw.map((item) => item.date)

  return res.json({ blockedWeekDays, blockedDates })
}
