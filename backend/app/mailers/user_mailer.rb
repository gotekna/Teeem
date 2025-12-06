class UserMailer < ApplicationMailer
  def welcome_email(user, temp_password)
    @user = user
    @temp_password = temp_password
    @login_url = ENV["FRONTEND_URL"] || "http://localhost:5173/login"

    mail(
      to: @user.email,
      subject: "Welcome to TEEEM - Your Account Has Been Created"
    )
  end
end
