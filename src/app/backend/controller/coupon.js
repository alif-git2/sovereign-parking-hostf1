import Coupon from "@/app/backend/models/coupon";

const normalizeCouponCode = (code) => {
  return String(code || "").trim().toUpperCase();
};

const toNumber = (value, defaultValue = 0) => {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return defaultValue;
  }

  return number;
};

export const calculateCouponDiscount = ({
  coupon,
  bookingType,
  amount,
}) => {
  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  if (!coupon.is_active) {
    throw new Error("Coupon is not active");
  }

  const now = new Date();

  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    throw new Error("Coupon is not active yet");
  }

  if (coupon.valid_to && now > new Date(coupon.valid_to)) {
    throw new Error("Coupon has expired");
  }

  if (
    coupon.applies_to &&
    coupon.applies_to.length > 0 &&
    !coupon.applies_to.includes(bookingType)
  ) {
    throw new Error("Coupon is not valid for this booking type");
  }

  const originalPrice = toNumber(amount);

  if (originalPrice <= 0) {
    throw new Error("Booking amount must be greater than 0");
  }

  if (originalPrice < coupon.min_booking_amount) {
    throw new Error(
      `Minimum booking amount is AUD ${coupon.min_booking_amount}`
    );
  }

  // usage_limit = 0 means unlimited
  if (
    coupon.usage_limit > 0 &&
    coupon.used_count >= coupon.usage_limit
  ) {
    throw new Error("Coupon usage limit reached");
  }

  let discountAmount = 0;

  if (coupon.discount_type === "percentage") {
    discountAmount = (originalPrice * coupon.discount_value) / 100;

    if (
      coupon.max_discount_amount !== null &&
      coupon.max_discount_amount !== undefined &&
      discountAmount > coupon.max_discount_amount
    ) {
      discountAmount = coupon.max_discount_amount;
    }
  }

  if (coupon.discount_type === "fixed") {
    discountAmount = coupon.discount_value;
  }

  if (discountAmount > originalPrice) {
    discountAmount = originalPrice;
  }

  const finalPrice = originalPrice - discountAmount;

  return {
    coupon_id: coupon._id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    original_price: Number(originalPrice.toFixed(2)),
    discount_amount: Number(discountAmount.toFixed(2)),
    final_price: Number(finalPrice.toFixed(2)),
  };
};

// Use this later inside bookingservice.js
export async function getCouponDiscountResult({
  code,
  bookingType,
  amount,
}) {
  const couponCode = normalizeCouponCode(code);

  if (!couponCode) {
    return {
      coupon_id: null,
      coupon_code: null,
      original_price: Number(amount || 0),
      discount_amount: 0,
      final_price: Number(amount || 0),
    };
  }

  const coupon = await Coupon.findOne({
    code: couponCode,
  });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  const result = calculateCouponDiscount({
    coupon,
    bookingType,
    amount,
  });

  return {
    coupon_id: result.coupon_id,
    coupon_code: result.code,
    original_price: result.original_price,
    discount_amount: result.discount_amount,
    final_price: result.final_price,
  };
}

export async function createCoupon(req) {
  try {
    const body = await req.json();

    const code = normalizeCouponCode(body.code);

    if (!code) {
      throw new Error("Coupon code is required");
    }

    if (!body.discount_type) {
      throw new Error("Discount type is required");
    }

    if (!["percentage", "fixed"].includes(body.discount_type)) {
      throw new Error("Invalid discount type");
    }

    if (body.discount_value === undefined || body.discount_value === null) {
      throw new Error("Discount value is required");
    }

    if (!body.valid_from) {
      throw new Error("Valid from date is required");
    }

    if (!body.valid_to) {
      throw new Error("Valid to date is required");
    }

    const existing = await Coupon.findOne({ code });

    if (existing) {
      throw new Error("Coupon code already exists");
    }

    const coupon = await Coupon.create({
      code,
      discount_type: body.discount_type,
      discount_value: toNumber(body.discount_value),

      max_discount_amount:
        body.max_discount_amount === undefined ||
        body.max_discount_amount === null ||
        body.max_discount_amount === ""
          ? null
          : toNumber(body.max_discount_amount),

      min_booking_amount: toNumber(body.min_booking_amount),

      applies_to: Array.isArray(body.applies_to)
        ? body.applies_to
        : [],

      valid_from: body.valid_from,
      valid_to: body.valid_to,

      usage_limit: toNumber(body.usage_limit),
      used_count: 0,

      is_active: body.is_active ?? true,
    });

    return Response.json(
      {
        success: true,
        data: coupon,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Coupon creation failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

export async function getCoupons(req) {
  try {
    const url =
      req?.url || "http://localhost/backend/router/coupons";

    const { searchParams } = new URL(url);

    const is_active = searchParams.get("is_active");
    const booking_type = searchParams.get("booking_type");
    const code = searchParams.get("code");

    const filter = {};

    if (is_active !== null) {
      filter.is_active = is_active === "true";
    }

    if (booking_type) {
      filter.$or = [
        { applies_to: { $size: 0 } },
        { applies_to: booking_type },
      ];
    }

    if (code) {
      filter.code = normalizeCouponCode(code);
    }

    const coupons = await Coupon.find(filter).sort({
      createdAt: -1,
    });

    return Response.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error("Fetch coupons failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

export async function validateCoupon(req) {
  try {
    const body = await req.json();

    const code = normalizeCouponCode(body.code);
    const bookingType = body.booking_type;
    const amount = toNumber(body.amount);

    if (!code) {
      throw new Error("Coupon code is required");
    }

    if (!bookingType) {
      throw new Error("Booking type is required");
    }

    if (!["cruise", "storage", "airport"].includes(bookingType)) {
      throw new Error("Invalid booking type");
    }

    const coupon = await Coupon.findOne({
      code,
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    const result = calculateCouponDiscount({
      coupon,
      bookingType,
      amount,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Coupon validation failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}

export async function updateCoupon(req, couponId) {
  try {
    const body = await req.json();

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      throw new Error("Coupon not found");
    }

    if (body.code !== undefined) {
      coupon.code = normalizeCouponCode(body.code);
    }

    if (body.discount_type !== undefined) {
      coupon.discount_type = body.discount_type;
    }

    if (body.discount_value !== undefined) {
      coupon.discount_value = toNumber(body.discount_value);
    }

    if (body.max_discount_amount !== undefined) {
      coupon.max_discount_amount =
        body.max_discount_amount === null ||
        body.max_discount_amount === ""
          ? null
          : toNumber(body.max_discount_amount);
    }

    if (body.min_booking_amount !== undefined) {
      coupon.min_booking_amount = toNumber(body.min_booking_amount);
    }

    if (body.applies_to !== undefined) {
      coupon.applies_to = Array.isArray(body.applies_to)
        ? body.applies_to
        : [];
    }

    if (body.valid_from !== undefined) {
      coupon.valid_from = body.valid_from;
    }

    if (body.valid_to !== undefined) {
      coupon.valid_to = body.valid_to;
    }

    if (body.usage_limit !== undefined) {
      coupon.usage_limit = toNumber(body.usage_limit);
    }

    if (body.is_active !== undefined) {
      coupon.is_active = body.is_active;
    }

    await coupon.save();

    return Response.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    console.error("Coupon update failed:", error);

    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}