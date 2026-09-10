import { connectDB } from "@/app/backend/database/mongodb";

import CruiseSchedule from "@/app/backend/models/cruiseschedule";

// Register Location model for populate
import "@/app/backend/models/location";


function getDaysDifference(
  departureDate,
  returnDate
) {
  if (!departureDate || !returnDate) {
    return 0;
  }

  const start = new Date(departureDate);
  const end = new Date(returnDate);

  const diffTime =
    end.getTime() - start.getTime();

  return Math.ceil(
    diffTime /
      (1000 * 60 * 60 * 24)
  );
}



function serializeCruiseSchedule(
  schedule
) {

  return {

    id: String(
      schedule._id
    ),

    _id: String(
      schedule._id
    ),


    departure_date:
      schedule.departure_date
        ? new Date(
            schedule.departure_date
          ).toISOString()
        : null,


    return_date:
      schedule.return_date
        ? new Date(
            schedule.return_date
          ).toISOString()
        : null,



    schedule_name:
      schedule.schedule_name || "",


    ship_name:
      schedule.schedule_name || "",



    schedule_type:
      schedule.schedule_type ||
      "cruise",



    shuttle_times:
      Array.isArray(
        schedule.shuttle_times
      )
        ? schedule.shuttle_times
        : [],



    shuttle_slots:
      Array.isArray(
        schedule.shuttle_slots
      )

      ?

      schedule.shuttle_slots.map(
        (slot) => ({

          _id:
            String(
              slot._id
            ),

          time:
            slot.time || "",


          capacity:
            Number(
              slot.capacity || 0
            ),


          booked_count:
            Number(
              slot.booked_count || 0
            ),


          is_active:
            slot.is_active !== false,

        })
      )

      :

      [],




    location_id:
      schedule.location_id
      ?

      {

        _id:
          String(
            schedule.location_id._id
          ),

        name:
          schedule.location_id.name ||
          "",

        type:
          schedule.location_id.type ||
          "",

        is_active:
          schedule.location_id.is_active !== false,

      }

      :

      null,




    capacity:
      Number(
        schedule.capacity || 0
      ),



    booked_count:
      Number(
        schedule.booked_count || 0
      ),



    price_per_slot:
      Number(
        schedule.price_per_slot || 0
      ),



    price:
      Number(
        schedule.price ||
        schedule.price_per_slot ||
        0
      ),



    is_active:
      schedule.is_active !== false,



    duration_days:
      getDaysDifference(
        schedule.departure_date,
        schedule.return_date
      ),



    days:
      getDaysDifference(
        schedule.departure_date,
        schedule.return_date
      ),

  };

}





export async function getCruiseSchedulesServer(){

  await connectDB();


  const schedules =
    await CruiseSchedule.find(
      {
        is_active: true,
      },
      {
        departure_date: 1,
        return_date: 1,
        schedule_name: 1,
        schedule_type: 1,
        shuttle_times: 1,
        shuttle_slots: 1,
        location_id: 1,
        capacity: 1,
        booked_count: 1,
        price_per_slot: 1,
        is_active: 1,
      }
    )

    .populate(
      "location_id",
      "name type is_active"
    )

    .sort({
      departure_date: 1,
    })

    .lean();



  return schedules.map(
    serializeCruiseSchedule
  );

}