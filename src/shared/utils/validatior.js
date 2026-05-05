export const isValidPhone = (mobile) => {
  const regex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
  return regex.test(mobile);
};

 export const isValidEmail = (email) => {
  const regex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};
