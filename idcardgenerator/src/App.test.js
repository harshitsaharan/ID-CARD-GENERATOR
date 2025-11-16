import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders ID Card Generator title", () => {
  render(<App />);
  const heading = screen.getByText(/ID Card Generator/i);
  expect(heading).toBeInTheDocument();
});
