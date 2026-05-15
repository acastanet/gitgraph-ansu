/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import MainLayout from "./layout/MainLayout";
import GitGraph from "./components/GitGraph";

export default function App() {
  return (
    <MainLayout>
      <GitGraph />
    </MainLayout>
  );
}

