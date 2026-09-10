import ParkingUser from "../models/park_user";

export async function getUsers(req) {
  try {
    const users = await ParkingUser.find()
      .sort({ createdAt: -1 });

    const safeUsers = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      wallet_balance: user.wallet_balance,
      is_active: user.is_active,
      has_password: Boolean(user.password),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return Response.json({
      success: true,
      count: safeUsers.length,
      data: safeUsers,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 400 }
    );
  }
}