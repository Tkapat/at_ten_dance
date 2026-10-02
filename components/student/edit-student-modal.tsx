"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Student } from "@/lib/types";
import {
  DEGREES,
  DEGREE_LIST,
  SECTIONS,
  departmentsFor,
  yearsFor,
} from "@/lib/constants";
import { studentFormSchema, type StudentFormValues } from "@/lib/schemas";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export function EditStudentModal({
  student,
  onOpenChange,
}: {
  student: Student | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    values: student
      ? {
          name: student.name,
          enrollmentNo: student.enrollmentNo,
          degree: student.degree,
          department: student.department ?? "",
          section: student.section,
          year: String(student.year),
        }
      : undefined,
  });

  const degree = useWatch({ control, name: "degree" });
  const hasDepartment = DEGREES[degree ?? "BTech"].hasDepartment;
  const yearOptions = yearsFor(degree ?? "BTech");

  async function onSubmit(values: StudentFormValues) {
    if (!student) return;
    try {
      await api().updateStudent(student.id, {
        name: values.name,
        enrollmentNo: values.enrollmentNo,
        degree: values.degree,
        department: hasDepartment ? values.department || null : null,
        section: values.section,
        year: Number(values.year),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["student", student.id] }),
        qc.invalidateQueries({ queryKey: ["students"] }),
        qc.invalidateQueries({ queryKey: ["summary"] }),
      ]);
      toast.success("Student updated.");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "The student could not be updated.";
      if (err instanceof ApiError && err.field === "enrollment_no") {
        toast.error(message);
      } else {
        toast.error(message);
      }
    }
  }

  return (
    <Modal
      open={Boolean(student)}
      onOpenChange={onOpenChange}
      title="Edit student"
      description={student ? `${student.name} · ${student.enrollmentNo}` : undefined}
      size="md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-student-form"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <form id="edit-student-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" htmlFor="edit-name" error={errors.name?.message}>
          <Input id="edit-name" {...register("name")} autoComplete="name" />
        </Field>

        <Field
          label="Enrollment number"
          htmlFor="edit-enrollment"
          error={errors.enrollmentNo?.message}
        >
          <Input id="edit-enrollment" {...register("enrollmentNo")} autoCapitalize="characters" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Degree" htmlFor="edit-degree" error={errors.degree?.message}>
            <Select id="edit-degree" {...register("degree")}>
              {DEGREE_LIST.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Section" htmlFor="edit-section" error={errors.section?.message}>
            <Select id="edit-section" {...register("section")}>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {hasDepartment ? (
            <Field label="Department" htmlFor="edit-department" error={errors.department?.message}>
              <Select id="edit-department" {...register("department")}>
                <option value="">—</option>
                {departmentsFor(degree ?? "BTech").map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}

          <Field label="Year" htmlFor="edit-year" error={errors.year?.message}>
            <Select id="edit-year" {...register("year")}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
