export const ok = (data: any = null, message: string = "Success") => ({
  success: true,
  message,
  data,
});
