import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';

export interface CountryPhoneOption {
  code: CountryCode;
  callingCode: string;
}

const supportedCountries = getCountries();
const supportedCountrySet = new Set<string>(supportedCountries);

export function listCountryPhoneOptions(): CountryPhoneOption[] {
  return supportedCountries.map((code) => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
  }));
}

export function normalizeInternationalPhone(countryCode: string, nationalNumber: string): string | null {
  const normalizedCountry = countryCode.trim().toUpperCase();
  if (!supportedCountrySet.has(normalizedCountry)) return null;

  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits || digits.length > 15) return null;

  const parsed = parsePhoneNumberFromString(digits, normalizedCountry as CountryCode);
  if (!parsed?.isValid() || parsed.country !== normalizedCountry) return null;
  return parsed.number;
}

export function maskPhone(phoneNumber: string): string {
  if (phoneNumber.length <= 7) return phoneNumber;
  return `${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-3)}`;
}
